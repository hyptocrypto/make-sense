import { IRect } from "../interfaces/IRect";

export class AutoRectUtil {
    private static APIendpoint: string = "http://107.20.58.60/onnx"

    public static reshapeImageData(imgData: any): number[][] {
        let r: number[] = []
        let g: number[] = []
        let b: number[] = []
        let a: number[] = new Array<number>(50176)
        a.fill(0)
        a[25200] = 255

        for (let i = 0; i < imgData.length; i += 4) {
            r.push(imgData[i])
            g.push(imgData[i + 1])
            b.push(imgData[i + 2])
            //a.push(img_data[i + 3])
        }

        return [r, g, b, a]
    }
    public static normalizeRgba(rgba: number[][]): number[] {
        const means = [5.4271e-01, 5.7049e-01, 5.8811e-01, 1.9930e-05]
        const stds = [0.0892, 0.0858, 0.0831, 0.0045]

        const newR: number[] = [];
        rgba[0].forEach((el) => newR.push(((el / 255.0) - means[0]) / stds[0]))
        const newG = [];
        rgba[1].forEach((el) => newG.push(((el / 255.0) - means[1]) / stds[1]))
        const newB = [];
        rgba[2].forEach((el) => newB.push(((el / 255.0) - means[2]) / stds[2]))
        const newA = [];
        rgba[3].forEach((el) => newA.push(((el / 255.0) - means[3]) / stds[3]))

        return newB.concat(newG.concat(newB.concat(newA)))
    }
    public static generateBbox(cords: number[], scaledRect: IRect): IRect {
        const predx: number = cords[0]
        const predy: number = cords[1]
        const predWidth: number = cords[2]
        const predHeight: number = cords[3]


        const xScale: number = scaledRect.width / 224
        const yScale: number = scaledRect.width / 224

        const xCenter: number = (predx as Number as number) * (224.0 * xScale)
        const yCenter: number = (predy as Number as number) * (224.0 * yScale)
        const width: number = (predWidth as Number as number) * (224.0 * xScale)
        const height: number = (predHeight as Number as number) * (224.0 * yScale)


        const bbox: IRect = {
            x: xCenter - (width / 2) + scaledRect.x,
            y: yCenter - (height / 2) + scaledRect.y,
            width: width,
            height: height
        }
        return bbox
    }
    public static makeCrop(scaledRect: IRect, imgData: any): ImageData {
        const img: HTMLImageElement = new Image();
        img.src = imgData.src;

        // Draw croped image onto canvas
        const canvas: HTMLCanvasElement = document.createElement("canvas");
        canvas.width = 224;
        canvas.height = 224;
        const ctx: CanvasRenderingContext2D = canvas.getContext("2d");
        ctx.drawImage(img,
            scaledRect.x, scaledRect.y,
            scaledRect.width,
            scaledRect.height,
            0, 0,
            224,
            224
        );
        return ctx.getImageData(0, 0, 224, 224);
    };

    public static async predict(normImg: number[], scaledRect: IRect, callback): Promise<void> {
        await fetch(this.APIendpoint,
            {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(normImg),
            })
            .then(res => res.json())
            .then(res => { callback(this.generateBbox(res, scaledRect)) })
            .catch((error) => {
                // TODO: MakeSense Error popup
                window.alert("Inference API not responding. Please try again later.")
                console.log(error)
            });
    };
}
