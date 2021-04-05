import { Tensor, InferenceSession } from "onnxjs";


export class AutoRectDetector {
    public isLoaded: boolean = false;
    public session = new InferenceSession();

    constructor(
        session: InferenceSession = new InferenceSession(),
        isLoaded: boolean = false) {
        this.session = session;
        this.isLoaded = isLoaded;
    }
    public async load() {
        await this.session.loadModel("http://54.157.122.103/static/tfjs_effloc_model/effloc.onnx")
        this.isLoaded = true;
    }
    public async predict(imgTensor: Tensor) {
        let outputMap = await this.session.run([imgTensor])
        let outputTensor = outputMap.values().next().value;
        return outputTensor
    }
}
