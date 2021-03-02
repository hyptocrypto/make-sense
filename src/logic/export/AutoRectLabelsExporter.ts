import { AnnotationFormatType } from "../../data/enums/AnnotationFormatType";
import { ImageData, LabelName, LabelAutoRect } from "../../store/labels/types";
import { ImageRepository } from "../imageRepository/ImageRepository";
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { LabelsSelector } from "../../store/selectors/LabelsSelector";
import { XMLSanitizerUtil } from "../../utils/XMLSanitizerUtil";
import { ExporterUtil } from "../../utils/ExporterUtil";
import { GeneralSelector } from "../../store/selectors/GeneralSelector";
import { findIndex, findLast } from "lodash";

export class AutoRectLabelsExporter {
    public static export(exportFormatType: AnnotationFormatType): void {
        switch (exportFormatType) {
            case AnnotationFormatType.YOLO:
                AutoRectLabelsExporter.exportAsYOLO();
                break;
            case AnnotationFormatType.VOC:
                AutoRectLabelsExporter.exportAsVOC();
                break;
            case AnnotationFormatType.CSV:
                AutoRectLabelsExporter.exportAsCSV();
                break;
            default:
                return;
        }
    }

    private static exportAsYOLO(): void {
        let zip = new JSZip();
        LabelsSelector.getImagesData()
            .forEach((imageData: ImageData) => {
                const fileContent: string = AutoRectLabelsExporter.wrapAutoRectLabelsIntoYOLO(imageData);
                if (fileContent) {
                    const fileName: string = imageData.fileData.name.replace(/\.[^/.]+$/, ".txt");
                    try {
                        zip.file(fileName, fileContent);
                    } catch (error) {
                        // TODO
                        throw new Error(error);
                    }
                }
            });

        try {
            zip.generateAsync({ type: "blob" })
                .then(function (content) {
                    saveAs(content, `${ExporterUtil.getExportFileName()}.zip`);
                });
        } catch (error) {
            // TODO
            throw new Error(error);
        }

    }

    private static wrapAutoRectLabelsIntoYOLO(imageData: ImageData): string {
        if (imageData.labelAutoRects.length === 0 || !imageData.loadStatus)
            return null;

        const labelNames: LabelName[] = LabelsSelector.getLabelNames();
        const image: HTMLImageElement = ImageRepository.getById(imageData.id);
        const labelAutoRectsString: string[] = imageData.labelAutoRects.map((labelAutoRect: LabelAutoRect) => {
            const labelFields = [
                findIndex(labelNames, { id: labelAutoRect.labelId }).toString(),
                ((labelAutoRect.rect.x + labelAutoRect.rect.width / 2) / image.width).toFixed(6).toString(),
                ((labelAutoRect.rect.y + labelAutoRect.rect.height / 2) / image.height).toFixed(6).toString(),
                (labelAutoRect.rect.width / image.width).toFixed(6).toString(),
                (labelAutoRect.rect.height / image.height).toFixed(6).toString()
            ];
            return labelFields.join(" ")
        });
        return labelAutoRectsString.join("\n");
    }

    private static exportAsVOC(): void {
        let zip = new JSZip();
        LabelsSelector.getImagesData().forEach((imageData: ImageData) => {
            const fileContent: string = AutoRectLabelsExporter.wrapImageIntoVOC(imageData);
            if (fileContent) {
                const fileName: string = imageData.fileData.name.replace(/\.[^/.]+$/, ".xml");
                try {
                    zip.file(fileName, fileContent);
                } catch (error) {
                    // TODO
                    throw new Error(error);
                }
            }
        });

        try {
            zip.generateAsync({ type: "blob" })
                .then(function (content) {
                    saveAs(content, `${ExporterUtil.getExportFileName()}.zip`);
                });
        } catch (error) {
            // TODO
            throw new Error(error);
        }
    }

    private static wrapAutoRectLabelsIntoVOC(imageData: ImageData): string {
        if (imageData.labelAutoRects.length === 0 || !imageData.loadStatus)
            return null;

        const labelNamesList: LabelName[] = LabelsSelector.getLabelNames();
        const labelAutoRectsString: string[] = imageData.labelAutoRects.map((labelAutoRect: LabelAutoRect) => {
            const labelName: LabelName = findLast(labelNamesList, { id: labelAutoRect.labelId });
            const labelFields = !!labelName ? [
                `\t<object>`,
                `\t\t<name>${labelName.name}</name>`,
                `\t\t<pose>Unspecified</pose>`,
                `\t\t<truncated>Unspecified</truncated>`,
                `\t\t<difficult>Unspecified</difficult>`,
                `\t\t<bndbox>`,
                `\t\t\t<xmin>${Math.round(labelAutoRect.rect.x)}</xmin>`,
                `\t\t\t<ymin>${Math.round(labelAutoRect.rect.y)}</ymin>`,
                `\t\t\t<xmax>${Math.round(labelAutoRect.rect.x + labelAutoRect.rect.width)}</xmax>`,
                `\t\t\t<ymax>${Math.round(labelAutoRect.rect.y + labelAutoRect.rect.height)}</ymax>`,
                `\t\t</bndbox>`,
                `\t</object>`
            ] : [];
            return labelFields.join("\n")
        });
        return labelAutoRectsString.join("\n");
    }

    private static wrapImageIntoVOC(imageData: ImageData): string {
        const labels: string = AutoRectLabelsExporter.wrapAutoRectLabelsIntoVOC(imageData);
        const projectName: string = XMLSanitizerUtil.sanitize(GeneralSelector.getProjectName());

        if (labels) {
            const image: HTMLImageElement = ImageRepository.getById(imageData.id);
            return [
                `<annotation>`,
                `\t<folder>${projectName}</folder>`,
                `\t<filename>${imageData.fileData.name}</filename>`,
                `\t<path>/${projectName}/${imageData.fileData.name}</path>`,
                `\t<source>`,
                `\t\t<database>Unspecified</database>`,
                `\t</source>`,
                `\t<size>`,
                `\t\t<width>${image.width}</width>`,
                `\t\t<height>${image.height}</height>`,
                `\t\t<depth>3</depth>`,
                `\t</size>`,
                labels,
                `</annotation>`
            ].join("\n");
        }
        return null;
    }


    private static exportAsCSV(): void {
        const content: string = LabelsSelector.getImagesData()
            .map((imageData: ImageData) => {
                return AutoRectLabelsExporter.wrapAutoRectLabelsIntoCSV(imageData)
            })
            .filter((imageLabelData: string) => {
                return !!imageLabelData
            })
            .join("\n");
        const fileName: string = `${ExporterUtil.getExportFileName()}.csv`;
        ExporterUtil.saveAs(content, fileName);
    }

    private static wrapAutoRectLabelsIntoCSV(imageData: ImageData): string {
        if (imageData.labelAutoRects.length === 0 || !imageData.loadStatus)
            return null;

        const image: HTMLImageElement = ImageRepository.getById(imageData.id);
        const labelNames: LabelName[] = LabelsSelector.getLabelNames();
        const labelAutoRectsString: string[] = imageData.labelAutoRects.map((labelAutoRect: LabelAutoRect) => {
            const labelName: LabelName = findLast(labelNames, { id: labelAutoRect.labelId });
            const labelFields = !!labelName ? [
                labelName.name,
                Math.round(labelAutoRect.rect.x).toString(),
                Math.round(labelAutoRect.rect.y).toString(),
                Math.round(labelAutoRect.rect.width).toString(),
                Math.round(labelAutoRect.rect.height).toString(),
                imageData.fileData.name,
                image.width.toString(),
                image.height.toString()
            ] : [];
            return labelFields.join(",")
        });
        return labelAutoRectsString.join("\n");
    }
}
