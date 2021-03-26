import { Tensor, InferenceSession } from "onnxjs";


export class AutoRectDetector {
    public is_loaded: boolean = false;
    public session = new InferenceSession();

    constructor(session: InferenceSession = new InferenceSession(),
        is_loaded: boolean = false) {
        this.session = session;
        this.is_loaded = is_loaded
    }
    public async load() {
        await this.session.loadModel("http://127.0.0.1:5000/static/tfjs_effloc_model/effloc.onnx")
        this.is_loaded = true;
    }
    public async predict(img_tensor: Tensor) {
        let outputMap = await this.session.run([img_tensor])
        let outputTensor = outputMap.values().next().value;
        return outputTensor
    }
}
