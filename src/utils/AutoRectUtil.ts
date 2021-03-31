import { IRect } from "../interfaces/IRect";

export class AutoRectUtil {
    private static api_endpoint: string = "http://54.157.122.103/predict"
    // private static api_endpoint: string = "http://localhost:5000/onnx"

    public static reshapeImageData(img_data: any): number[][] {
        let r: number[] = []
        let g: number[] = []
        let b: number[] = []
        let a: number[] = new Array<number>(50176)
        a.fill(0)
        a[25200] = 255

        for (let i = 0; i < img_data.length; i += 4) {
            r.push(img_data[i])
            g.push(img_data[i + 1])
            b.push(img_data[i + 2])
            //a.push(img_data[i + 3])
        }

        return [r, g, b, a]
    }
    public static normalizeRgba(rgba: number[][]): number[] {
        const means = [5.4271e-01, 5.7049e-01, 5.8811e-01, 1.9930e-05]
        const stds = [0.0892, 0.0858, 0.0831, 0.0045]
        const new_r: number[] = [];

        rgba[0].forEach((el, index) => new_r.push(((el / 255.0) - means[0]) / stds[0]))
        const new_g = [];
        rgba[1].forEach((el, index) => new_g.push(((el / 255.0) - means[1]) / stds[1]))
        const new_b = [];
        rgba[2].forEach((el, index) => new_b.push(((el / 255.0) - means[2]) / stds[2]))
        const new_a = [];
        rgba[3].forEach((el, index) => new_a.push(((el / 255.0) - means[3]) / stds[3]))

        return new_r.concat(new_g.concat(new_b.concat(new_a)))
    }
    public static generateBbox(cords: number[], scaled_rect: IRect): IRect {
        const predx: number = cords[0]
        const predy: number = cords[1]
        const pred_width: number = cords[2]
        const pred_height: number = cords[3]


        const x_scale_ratio: number = scaled_rect.width / 224
        const y_scale_ratio: number = scaled_rect.width / 224

        const new_box_centerx: number = (predx as Number as number) * (224.0 * x_scale_ratio)
        const new_box_centery: number = (predy as Number as number) * (224.0 * y_scale_ratio)
        const new_box_width: number = (pred_width as Number as number) * (224.0 * x_scale_ratio)
        const new_box_height: number = (pred_height as Number as number) * (224.0 * y_scale_ratio)


        const bbox: IRect = {
            x: new_box_centerx - (new_box_width / 2) + scaled_rect.x,
            y: new_box_centery - (new_box_height / 2) + scaled_rect.y,
            width: new_box_width,
            height: new_box_height
        }
        return bbox
    }
    public static makeCrop(scaled_rect: IRect, img_data: any): ImageData {
        const img: HTMLImageElement = new Image();
        img.src = img_data.src;

        // Draw croped image onto canvas
        const canvas: HTMLCanvasElement = document.createElement("canvas");
        canvas.width = 224;
        canvas.height = 224;
        const ctx: CanvasRenderingContext2D = canvas.getContext("2d");
        ctx.drawImage(img,
            scaled_rect.x, scaled_rect.y,
            scaled_rect.width,
            scaled_rect.height,
            0, 0,
            224,
            224
        );
        return ctx.getImageData(0, 0, 224, 224);
    };

    public static async predict(norm_img: number[], scaled_rect: IRect, callback): Promise<void> {
        await fetch(this.api_endpoint,
            {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(norm_img),
            })
            .then(res => res.json())
            .then(res => { callback(this.generateBbox(res, scaled_rect)) })
            .catch((error) => {
                // TODO: MakeSense Error popup
                window.alert("Inference API not responding. Please try again later.")
                console.log(error)
            });
    };
}
