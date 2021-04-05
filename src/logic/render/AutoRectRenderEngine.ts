import { IPoint } from "../../interfaces/IPoint";
import { IRect } from "../../interfaces/IRect";
import { RectUtil } from "../../utils/RectUtil";
import { AutoRectUtil } from "../../utils/AutoRectUtil";
import { DrawUtil } from "../../utils/DrawUtil";
import { store } from "../..";
import { ImageData, LabelAutoRect } from "../../store/labels/types";
import { ImageRepository } from "../../logic/imageRepository/ImageRepository"
import {
    updateActiveLabelId,
    updateFirstLabelCreatedFlag,
    updateHighlightedLabelId,
    updateImageDataById
} from "../../store/labels/actionCreators";
import { PointUtil } from "../../utils/PointUtil";
import { RectAnchor } from "../../data/RectAnchor";
import { RenderEngineConfig } from "../../settings/RenderEngineConfig";
import { updateCustomCursorStyle } from "../../store/general/actionCreators";
import { CustomCursorStyle } from "../../data/enums/CustomCursorStyle";
import { LabelsSelector } from "../../store/selectors/LabelsSelector";
import { EditorData } from "../../data/EditorData";
import { BaseRenderEngine } from "./BaseRenderEngine";
import { RenderEngineUtil } from "../../utils/RenderEngineUtil";
import { LabelType } from "../../data/enums/LabelType";
import { EditorActions } from "../actions/EditorActions";
import { GeneralSelector } from "../../store/selectors/GeneralSelector";
import { LabelStatus } from "../../data/enums/LabelStatus";
import { LabelUtil } from "../../utils/LabelUtil";




export class AutoRectRenderEngine extends BaseRenderEngine {
    private config: RenderEngineConfig = new RenderEngineConfig();
    // =================================================================================================================
    // STATE
    // =================================================================================================================
    private startCreateAutoRectPoint: IPoint;
    private startResizeRectAnchor: RectAnchor;

    public constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.labelType = LabelType.AUTORECT;
    }

    // =================================================================================================================
    // EVENT HANDLERS
    // =================================================================================================================

    public mouseDownHandler = (data: EditorData) => {
        const isMouseOverImage: boolean = RenderEngineUtil.isMouseOverImage(data);
        const isMouseOverCanvas: boolean = RenderEngineUtil.isMouseOverCanvas(data);
        if (isMouseOverCanvas) {
            const rectUnderMouse: LabelAutoRect = this.getRectUnderMouse(data);
            if (!!rectUnderMouse) {
                const rect: IRect = this.calculateRectRelativeToActiveImage(rectUnderMouse.rect, data);
                const anchorUnderMouse: RectAnchor = this.getAnchorUnderMouseByRect(rect, data.mousePositionOnViewPortContent, data.viewPortContentImageRect);
                if (!!anchorUnderMouse && rectUnderMouse.status === LabelStatus.ACCEPTED) {
                    store.dispatch(updateActiveLabelId(rectUnderMouse.id));
                    this.startRectResize(anchorUnderMouse);
                }
                else {
                    if (!!LabelsSelector.getHighlightedLabelId())
                        store.dispatch(updateActiveLabelId(LabelsSelector.getHighlightedLabelId()));
                    else
                        this.startRectCreation(data.mousePositionOnViewPortContent);
                }
            } else if (isMouseOverImage) {
                this.startRectCreation(data.mousePositionOnViewPortContent);
            }
        }
    };

    public mouseUpHandler = (data: EditorData) => {
        if (!!data.viewPortContentImageRect) {
            const mousePositionSnapped: IPoint = RectUtil.snapPointToRect(data.mousePositionOnViewPortContent, data.viewPortContentImageRect);
            const activeLabelAutoRect: LabelAutoRect = LabelsSelector.getActiveAutoRectLabel();
            if (!!this.startCreateAutoRectPoint) {
                const minX: number = this.startCreateAutoRectPoint.x;
                const minY: number = this.startCreateAutoRectPoint.y;
                const boxWidth: number = 100 // Should be dynamic based on desired object size
                const boxHeight: number = 100 // Should be dynamic based on desired object size

                // Create rect within crosshairs on viewport and image
                const rect: IRect = {
                    x: minX - (boxWidth / 2),
                    y: minY - (boxHeight / 2),
                    width: boxWidth,
                    height: boxHeight
                }
                const scaledRect: IRect = RenderEngineUtil.transferRectFromImageToViewPortContent(rect, data);

                // Create Image element from current image data
                const image: ImageData = LabelsSelector.getActiveImageData();
                const imgData: HTMLImageElement = ImageRepository.getById(image.id);

                // Grab crop of image
                const cropData = AutoRectUtil.makeCrop(scaledRect, imgData);

                // Normalize the data
                const rgba: number[][] = AutoRectUtil.reshapeImageData(cropData.data)
                const normImg: number[] = AutoRectUtil.normalizeRgba(rgba)

                if (!!normImg && !!scaledRect) {
                    // Run prediction on cropped image and plot bounding box 
                    AutoRectUtil.predict(normImg, scaledRect, this.addAutoRectLabel)
                }
            }

            if (!!this.startResizeRectAnchor && !!activeLabelAutoRect) {
                const rect: IRect = this.calculateRectRelativeToActiveImage(activeLabelAutoRect.rect, data);
                const startAnchorPosition: IPoint = PointUtil.add(this.startResizeRectAnchor.position,
                    data.viewPortContentImageRect);
                const delta: IPoint = PointUtil.subtract(mousePositionSnapped, startAnchorPosition);
                const resizeRect: IRect = RectUtil.resizeRect(rect, this.startResizeRectAnchor.type, delta);
                const scale: number = RenderEngineUtil.calculateImageScale(data);
                const scaledAutoRect: IRect = RectUtil.scaleRect(resizeRect, scale);

                const imageData = LabelsSelector.getActiveImageData();
                imageData.labelAutoRects = imageData.labelAutoRects.map((labelAutoRect: LabelAutoRect) => {
                    if (labelAutoRect.id === activeLabelAutoRect.id) {
                        return {
                            ...labelAutoRect,
                            rect: scaledAutoRect
                        };
                    }
                    return labelAutoRect;
                });
                store.dispatch(updateImageDataById(imageData.id, imageData));
            }
        }
        this.endRectTransformation()
    };


    public mouseMoveHandler = (data: EditorData) => {
        if (!!data.viewPortContentImageRect && !!data.mousePositionOnViewPortContent) {
            const isOverImage: boolean = RenderEngineUtil.isMouseOverImage(data);
            if (isOverImage && !this.startResizeRectAnchor) {
                const labelAutoRect: LabelAutoRect = this.getRectUnderMouse(data);
                if (!!labelAutoRect && !this.isInProgress()) {
                    if (LabelsSelector.getHighlightedLabelId() !== labelAutoRect.id) {
                        store.dispatch(updateHighlightedLabelId(labelAutoRect.id))
                    }
                } else {
                    if (LabelsSelector.getHighlightedLabelId() !== null) {
                        store.dispatch(updateHighlightedLabelId(null))
                    }
                }
            }
        }
    };

    // =================================================================================================================
    // RENDERING
    // =================================================================================================================

    public render(data: EditorData) {
        const activeLabelId: string = LabelsSelector.getActiveLabelId();
        const imageData: ImageData = LabelsSelector.getActiveImageData();

        if (imageData) {
            imageData.labelAutoRects.forEach((labelAutoRect: LabelAutoRect) => {
                const displayAsActive: boolean =
                    labelAutoRect.status === LabelStatus.ACCEPTED && labelAutoRect.id === activeLabelId;
                displayAsActive ? this.drawActiveRect(labelAutoRect, data) : this.drawInactiveRect(labelAutoRect, data);
            });
            this.drawCurrentlyCreatedRect(data.mousePositionOnViewPortContent, data.viewPortContentImageRect);
            this.updateCursorStyle(data);
        }
    }

    private drawCurrentlyCreatedRect(mousePosition: IPoint, imageRect: IRect) {
        if (!!this.startCreateAutoRectPoint) {
            const mousePositionSnapped: IPoint = RectUtil.snapPointToRect(mousePosition, imageRect);
            const activeRect: IRect = {
                x: this.startCreateAutoRectPoint.x,
                y: this.startCreateAutoRectPoint.y,
                width: mousePositionSnapped.x - this.startCreateAutoRectPoint.x,
                height: mousePositionSnapped.y - this.startCreateAutoRectPoint.y
            };
            const activeRectBetweenPixels = RenderEngineUtil.setRectBetweenPixels(activeRect);
            DrawUtil.drawRect(this.canvas, activeRectBetweenPixels, this.config.lineActiveColor, this.config.lineThickness);
        }
    }

    private drawInactiveRect(labelAutoRect: LabelAutoRect, data: EditorData) {
        const rectOnImage: IRect = RenderEngineUtil.transferRectFromViewPortContentToImage(labelAutoRect.rect, data);
        const highlightedLabelId: string = LabelsSelector.getHighlightedLabelId();
        const displayAsActive: boolean = labelAutoRect.status === LabelStatus.ACCEPTED && labelAutoRect.id === highlightedLabelId;
        this.renderRect(rectOnImage, displayAsActive);
    }

    private drawActiveRect(labelRect: LabelAutoRect, data: EditorData) {
        let rect: IRect = this.calculateRectRelativeToActiveImage(labelRect.rect, data);
        if (!!this.startResizeRectAnchor) {
            const startAnchorPosition: IPoint = PointUtil.add(this.startResizeRectAnchor.position, data.viewPortContentImageRect);
            const endAnchorPositionSnapped: IPoint = RectUtil.snapPointToRect(data.mousePositionOnViewPortContent, data.viewPortContentImageRect);
            const delta = PointUtil.subtract(endAnchorPositionSnapped, startAnchorPosition);
            rect = RectUtil.resizeRect(rect, this.startResizeRectAnchor.type, delta);
        }
        const rectOnImage: IRect = RectUtil.translate(rect, data.viewPortContentImageRect);
        this.renderRect(rectOnImage, true);
    }

    private renderRect(rectOnImage: IRect, isActive: boolean) {
        const rectBetweenPixels = RenderEngineUtil.setRectBetweenPixels(rectOnImage);
        const lineColor: string = isActive ? this.config.lineActiveColor : this.config.lineInactiveColor;
        DrawUtil.drawRect(this.canvas, rectBetweenPixels, lineColor, this.config.lineThickness);
        if (isActive) {
            const handleCenters: IPoint[] = RectUtil.mapRectToAnchors(rectOnImage).map((rectAnchor: RectAnchor) => rectAnchor.position);
            handleCenters.forEach((center: IPoint) => {
                const handleRect: IRect = RectUtil.getRectWithCenterAndSize(center, this.config.anchorSize);
                const handleRectBetweenPixels: IRect = RenderEngineUtil.setRectBetweenPixels(handleRect);
                DrawUtil.drawRectWithFill(this.canvas, handleRectBetweenPixels, this.config.activeAnchorColor);
            })
        }
    }

    private updateCursorStyle(data: EditorData) {
        if (!!this.canvas && !!data.mousePositionOnViewPortContent && !GeneralSelector.getImageDragModeStatus()) {
            const rectUnderMouse: LabelAutoRect = this.getRectUnderMouse(data);
            const rectAnchorUnderMouse: RectAnchor = this.getAnchorUnderMouse(data);
            if ((!!rectAnchorUnderMouse && rectUnderMouse && rectUnderMouse.status === LabelStatus.ACCEPTED) || !!this.startResizeRectAnchor) {
                store.dispatch(updateCustomCursorStyle(CustomCursorStyle.MOVE));
                return;
            }
            else if (RenderEngineUtil.isMouseOverCanvas(data)) {
                if (!RenderEngineUtil.isMouseOverImage(data) && !!this.startCreateAutoRectPoint)
                    store.dispatch(updateCustomCursorStyle(CustomCursorStyle.MOVE));
                else
                    RenderEngineUtil.wrapDefaultCursorStyleInCancel(data);
                this.canvas.style.cursor = "none";
            } else {
                this.canvas.style.cursor = "default";
            }
        }
    }

    // =================================================================================================================
    // HELPERS
    // =================================================================================================================

    public isInProgress(): boolean {
        return !!this.startCreateAutoRectPoint || !!this.startResizeRectAnchor;
    }

    private calculateRectRelativeToActiveImage(rect: IRect, data: EditorData): IRect {
        const scale: number = RenderEngineUtil.calculateImageScale(data);
        return RectUtil.scaleRect(rect, 1 / scale);
    }

    private addAutoRectLabel = (rect: IRect) => {
        const activeLabelId = LabelsSelector.getActiveLabelNameId();
        const imageData: ImageData = LabelsSelector.getActiveImageData();
        const labelRect: LabelAutoRect = LabelUtil.createLabelAutoRect(activeLabelId, rect);
        imageData.labelAutoRects.push(labelRect);
        store.dispatch(updateImageDataById(imageData.id, imageData));
        store.dispatch(updateFirstLabelCreatedFlag(true));
        store.dispatch(updateActiveLabelId(labelRect.id));
    };

    private getRectUnderMouse(data: EditorData): LabelAutoRect {
        const activeRectLabel: LabelAutoRect = LabelsSelector.getActiveAutoRectLabel();
        if (!!activeRectLabel && this.isMouseOverRectEdges(activeRectLabel.rect, data)) {
            return activeRectLabel;
        }

        const labelAutoRects: LabelAutoRect[] = LabelsSelector.getActiveImageData().labelAutoRects;
        for (let i = 0; i < labelAutoRects.length; i++) {
            if (this.isMouseOverRectEdges(labelAutoRects[i].rect, data)) {
                return labelAutoRects[i];
            }
        }
        return null;
    }

    private isMouseOverRectEdges(rect: IRect, data: EditorData): boolean {
        const rectOnImage: IRect = RectUtil.translate(
            this.calculateRectRelativeToActiveImage(rect, data), data.viewPortContentImageRect);

        const outerRectDelta: IPoint = {
            x: this.config.anchorHoverSize.width / 2,
            y: this.config.anchorHoverSize.height / 2
        };
        const outerRect: IRect = RectUtil.expand(rectOnImage, outerRectDelta);

        const innerRectDelta: IPoint = {
            x: - this.config.anchorHoverSize.width / 2,
            y: - this.config.anchorHoverSize.height / 2
        };
        const innerRect: IRect = RectUtil.expand(rectOnImage, innerRectDelta);

        return (RectUtil.isPointInside(outerRect, data.mousePositionOnViewPortContent) &&
            !RectUtil.isPointInside(innerRect, data.mousePositionOnViewPortContent));
    }

    private getAnchorUnderMouseByRect(rect: IRect, mousePosition: IPoint, imageRect: IRect): RectAnchor {
        const rectAnchors: RectAnchor[] = RectUtil.mapRectToAnchors(rect);
        for (let i = 0; i < rectAnchors.length; i++) {
            const anchorRect: IRect = RectUtil.translate(RectUtil.getRectWithCenterAndSize(rectAnchors[i].position, this.config.anchorHoverSize), imageRect);
            if (!!mousePosition && RectUtil.isPointInside(anchorRect, mousePosition)) {
                return rectAnchors[i];
            }
        }
        return null;
    }

    private getAnchorUnderMouse(data: EditorData): RectAnchor {
        const labelAutoRects: LabelAutoRect[] = LabelsSelector.getActiveImageData().labelAutoRects;
        for (let i = 0; i < labelAutoRects.length; i++) {
            const rect: IRect = this.calculateRectRelativeToActiveImage(labelAutoRects[i].rect, data);
            const rectAnchor = this.getAnchorUnderMouseByRect(rect, data.mousePositionOnViewPortContent, data.viewPortContentImageRect);
            if (!!rectAnchor) return rectAnchor;
        }
        return null;
    }

    private startRectCreation(mousePosition: IPoint) {
        this.startCreateAutoRectPoint = mousePosition;
        store.dispatch(updateActiveLabelId(null));
        EditorActions.setViewPortActionsDisabledStatus(true);
    }

    private startRectResize(activatedAnchor: RectAnchor) {
        this.startResizeRectAnchor = activatedAnchor;
        EditorActions.setViewPortActionsDisabledStatus(true);
    }

    private endRectTransformation() {
        this.startCreateAutoRectPoint = null;
        this.startResizeRectAnchor = null;
        EditorActions.setViewPortActionsDisabledStatus(false);
    }
}


