import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as tf from '@tensorflow/tfjs'

import { IPoint } from "../../interfaces/IPoint";
import { IRect } from "../../interfaces/IRect";
import { RectUtil } from "../../utils/RectUtil";
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
import { PopupWindowType } from "../../data/enums/PopupWindowType";
import { updateActivePopupType } from "../../store/general/actionCreators";
import { PopupActions } from "../actions/PopupActions";
import { Tensor, InferenceSession } from "onnxjs";



import { AISelector } from "../../store/selectors/AISelector";
import * as image_js from "image-js"
import { ImageLoadManager } from "../imageRepository/ImageLoadManager";

// const Image = require('image-js');
const ndarray = require("ndarray");
var level = require('level');
var db = level(__dirname + '/db');
var fs = require('level-fs')(db);
const ObjectsToCsv = require('objects-to-csv');


export class AutoRectRenderEngine extends BaseRenderEngine {
    private config: RenderEngineConfig = new RenderEngineConfig();

    // =================================================================================================================
    // STATE
    // =================================================================================================================
    private startCreateRectPoint: IPoint;
    private startResizeRectAnchor: RectAnchor;

    private isModelLoaded: boolean = false;

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
                } else {
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
            if (!!this.startCreateRectPoint) {
                const minX: number = this.startCreateRectPoint.x;
                const minY: number = this.startCreateRectPoint.y;
                const box_width: number = 80 // Should be dynamic based on desired object size
                const box_height: number = 80
                const rect = { x: minX - (box_width / 2), y: minY - (box_height / 2), width: box_width, height: box_height }

                const scaled_rect = RenderEngineUtil.transferRectFromImageToViewPortContent(rect, data)

                // Create Image element from current image data
                const imageData: ImageData = LabelsSelector.getActiveImageData();
                const imageid: string = imageData.id;
                const img_data: any = ImageRepository.getById(imageid);
                const img: HTMLImageElement = new Image();
                img.src = img_data.src;

                // Draw croped image onto canvas
                const canvas: any = document.createElement("canvas");
                canvas.width = 224;
                canvas.height = 224;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img,
                    scaled_rect.x, scaled_rect.y,
                    scaled_rect.width,
                    scaled_rect.height,
                    0, 0,
                    224,
                    224
                );
                const ctx_data = ctx.getImageData(0, 0, 224, 224);


                // const crop_img: HTMLImageElement = new Image()
                // crop_img.src = canvas.toDataURL();
                // var w = window.open("");
                // w.document.write(crop_img.outerHTML);

                const w = window.open("");



                // const [newimg, rgba] = this.reshape_image_data(ctx_data.data)
                // const input_img = this.normalize_image_data(rgba[0], rgba[1], rgba[2], rgba[3])
                // const test_newimg = ndarray(new Float32Array(newimg), [1, 4, 224, 224])
                // const crop_img: HTMLImageElement = new Image()
                // crop_img.src = canvas.toDataURL();
                // w.document.write(String(input_img));


                // TODO: Load model on page load, not on first click. 
                (async () => {
                    // new_ctx.drawImage(crop_img, 0, 0, scaled_rect.width, scaled_rect.height);
                    // let crop_img_canvas = new_ctx.getImageData(0, 0, 224, 224)
                    // console.log(crop_img_canvas)
                    // let uint_ary: Uint8ClampedArray = crop_img_canvas.data.toString();

                    // if (!this.isModelLoaded) {
                    //     store.dispatch(updateActivePopupType(PopupWindowType.LOADER));
                    // }
                    const session = new InferenceSession({ backendHint: "cpu" });
                    await session.loadModel("http://127.0.0.1:5000/static/tfjs_effloc_model/effloc.onnx")

                    const [newimg, rgba] = this.reshape_image_data(ctx_data.data)
                    console.log(ctx_data)
                    console.log("THIS IS NE", newimg)
                    console.log(rgba)

                    // const new_canv: any = document.createElement("canvas")
                    // const new_ctx = new_canv.getContext("2d");

                    // var pallet = new_ctx.getImageData(0, 0, 224, 224)
                    // pallet.data.set(new Uint8ClampedArray(newimg))

                    // new_ctx.putImageData(pallet, 0, 0)

                    // const testimg: HTMLImageElement = new Image()
                    // testimg.src = new_canv.toDataURL();

                    // var w = window.open("")
                    // w.document.write(testimg.outerHTML)
                    // const dataProcessed = ndarray(new Float32Array(224 * 224 * 4), [1, 4, 224, 224]);

                    const input_img = this.normalize_image_data(rgba[0], rgba[1], rgba[2], rgba[3])



                    const dataProcessed = ndarray(new Float32Array(input_img), [1, 224, 224, 4]).transpose(0, 3, 1, 2)
                    console.log(dataProcessed)


                    const input = new onnx.Tensor(dataProcessed.data, "float32", [1, 4, 224, 224])





                    console.log(input)

                    const outputMap = await session.run([input]);
                    const outputTensor = outputMap.values().next().value;

                    const preds = outputTensor.data
                    console.log(preds)

                    const x_scale_ratio = scaled_rect.width / 224
                    const y_scale_ratio = scaled_rect.width / 224
                    // console.log(x_scale_ratio)

                    // console.log(typeof (outputTensor.data[0]))
                    // console.log(outputTensor.data[0])
                    const predx = outputTensor.data[0]
                    // console.log(predx)
                    const predy = outputTensor.data[1]
                    const pred_width = outputTensor.data[2]
                    const pred_height = outputTensor.data[3]

                    // console.log(typeof (predx))
                    const new_box_centerx = (predx as Number as number) * (224.0 * x_scale_ratio)
                    const new_box_centery = (predy as Number as number) * (224.0 * y_scale_ratio)
                    const new_box_width = (pred_width as Number as number) * (224.0 * x_scale_ratio)
                    const new_box_height = (pred_height as Number as number) * (224.0 * y_scale_ratio)

                    const rel_new_box_centerx = (predx as Number as number) * (224.0)
                    const rel_new_box_centery = (predy as Number as number) * (224.0)
                    const rel_new_box_width = (pred_width as Number as number) * (224.0)
                    const rel_new_box_height = (pred_height as Number as number) * (224.0)

                    const rel_new_xmin = rel_new_box_centerx - (rel_new_box_width / 2)
                    const rel_new_ymin = rel_new_box_centery - (rel_new_box_height / 2)
                    const rel_new_xmax = rel_new_xmin + rel_new_box_width
                    const rel_new_ymax = rel_new_ymin + rel_new_box_height

                    const bbox: IRect = {
                        x: new_box_centerx - (new_box_width / 2) + scaled_rect.x,
                        y: new_box_centery - (new_box_height / 2) + scaled_rect.y,
                        width: new_box_width,
                        height: new_box_height
                    }

                    ctx.beginPath();
                    ctx.moveTo(rel_new_xmin, rel_new_ymin);
                    ctx.lineTo(rel_new_xmin, rel_new_ymax);
                    ctx.lineTo(rel_new_xmax, rel_new_ymax);
                    ctx.lineTo(rel_new_xmax, rel_new_ymin);
                    ctx.lineTo(rel_new_xmin, rel_new_ymin);
                    ctx.stroke();

                    console.log(bbox)
                    this.addAutoRectLabel(bbox)


                    console.log(outputTensor)


                    // const model = await tf.loadGraphModel('http://127.0.0.1:5000/static/tfjs_effloc_model/model.json')
                    // console.log(model)
                    // const preds = model.predict(tf.randomNormal([1, 4, 224, 224]))
                    // console.log(preds)

                    // const model = await cocoSsd.load().then();
                    // PopupActions.close()
                    // this.isModelLoaded = true;
                    // console.log(AISelector.isAIObjectDetectorModelLoaded())
                    // const preds = await model.detect(crop_img);
                    // if (preds[0] === undefined) {
                    //     return;
                    // }
                    // console.log(preds[0].class)
                    // const object_rect = {
                    //     x: (scaled_rect.x + preds[0].bbox[0]),
                    //     y: (scaled_rect.y + preds[0].bbox[1]),
                    //     width: preds[0].bbox[2],
                    //     height: preds[0].bbox[3]
                    // };
                    // this.addAutoRectLabel(object_rect)
                })().then(res => {
                    const crop_img: HTMLImageElement = new Image()
                    crop_img.src = canvas.toDataURL();
                    w.document.write(crop_img.outerHTML)
                }
                );
                // this.addAutoRectLabel(rect)

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
        if (!!this.startCreateRectPoint) {
            const mousePositionSnapped: IPoint = RectUtil.snapPointToRect(mousePosition, imageRect);
            const activeRect: IRect = {
                x: this.startCreateRectPoint.x,
                y: this.startCreateRectPoint.y,
                width: mousePositionSnapped.x - this.startCreateRectPoint.x,
                height: mousePositionSnapped.y - this.startCreateRectPoint.y
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
                if (!RenderEngineUtil.isMouseOverImage(data) && !!this.startCreateRectPoint)
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
        return !!this.startCreateRectPoint || !!this.startResizeRectAnchor;
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
        this.startCreateRectPoint = mousePosition;
        store.dispatch(updateActiveLabelId(null));
        EditorActions.setViewPortActionsDisabledStatus(true);
    }

    private startRectResize(activatedAnchor: RectAnchor) {
        this.startResizeRectAnchor = activatedAnchor;
        EditorActions.setViewPortActionsDisabledStatus(true);
    }

    private endRectTransformation() {
        this.startCreateRectPoint = null;
        this.startResizeRectAnchor = null;
        EditorActions.setViewPortActionsDisabledStatus(false);
    }


    private reshape_image_data(img_data: any): [number[], any] {
        let r: number[] = []
        let g: number[] = []
        let b: number[] = []
        let a = new Array<number>(50176);
        a.fill(0)
        a[25200] = 255
        let rgba = [r, g, b, a]

        let full_img: number[] = []
        for (let i = 0; i < img_data.length; i += 4) {
            r.push(img_data[i])
            g.push(img_data[i + 1])
            b.push(img_data[i + 2])
            //a.push(img_data[i + 3])
        }
        full_img = full_img.concat(r)
        full_img = full_img.concat(g)
        full_img = full_img.concat(b)
        full_img = full_img.concat(a)
        return [full_img, rgba]
    }

    private normalize_image_data(r, g, b, a) {
        const means = [5.4271e-01, 5.7049e-01, 5.8811e-01, 1.9930e-05]
        const stds = [0.0892, 0.0858, 0.0831, 0.0045]
        const new_r = [];
        r.forEach((el, index) => new_r.push(((el / 255.0) - means[0]) / stds[0]))
        const new_g = [];
        g.forEach((el, index) => new_g.push(((el / 255.0) - means[1]) / stds[1]))
        const new_b = [];
        b.forEach((el, index) => new_b.push(((el / 255.0) - means[2]) / stds[2]))
        const new_a = [];
        a.forEach((el, index) => new_a.push(((el / 255.0) - means[3]) / stds[3]))
        const data_list = new_r.concat(new_g.concat(new_b.concat(new_a)))

        console.log(data_list)
        return data_list
    }
    private normalize(val, mean, std) {
        return val - (mean / std)
    }
}


