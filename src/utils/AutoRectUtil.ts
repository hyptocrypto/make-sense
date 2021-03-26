import {IRect} from "../interfaces/IRect";

export class AutoRectUtil {
    public static reshape_image_data(img_data: any) {
        let r: number[] = []
        let g: number[] = []
        let b: number[] = []
        let a = new Array<number>(50176)
        a.fill(0)
        a[25200] = 255

        for (let i = 0; i < img_data.length; i += 4) {
            r.push(img_data[i])
            g.push(img_data[i + 1])
            b.push(img_data[i + 2])
            //a.push(img_data[i + 3])
        }

        return [r,g,b,a]
    }
    public static normalize_image_data(r, g, b, a) {
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
        return data_list
    }
    public static generate_bbox(cords, scaled_rect): IRect {
        const predx = cords[0]
        const predy = cords[1]
        const pred_width = cords[2]
        const pred_height = cords[3]


        const x_scale_ratio = scaled_rect.width / 224
        const y_scale_ratio = scaled_rect.width / 224

        const new_box_centerx = (predx as Number as number) * (224.0 * x_scale_ratio)
        const new_box_centery = (predy as Number as number) * (224.0 * y_scale_ratio)
        const new_box_width = (pred_width as Number as number) * (224.0 * x_scale_ratio)
        const new_box_height = (pred_height as Number as number) * (224.0 * y_scale_ratio)


        const bbox: IRect = {
            x: new_box_centerx - (new_box_width / 2) + scaled_rect.x,
            y: new_box_centery - (new_box_height / 2) + scaled_rect.y,
            width: new_box_width,
            height: new_box_height
        }
        return bbox
    }
    public static normalize_val(val, mean, std) {
        return val - (mean / std)
    }

    public static make_crop(scaled_rect: IRect, img_data: any): any {
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
        return ctx.getImageData(0, 0, 224, 224);


    };
}
