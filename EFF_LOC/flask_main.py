from flask import Flask, request, Response, json, url_for, send_from_directory, jsonify, make_response
from flask_cors import CORS, cross_origin
import os
import re 
import subprocess
import onnxruntime
import numpy as np


app = Flask(__name__)
CORS(app)

session = onnxruntime.InferenceSession("./static/tfjs_effloc_model/effloc.onnx")
input_name = session.get_inputs()[0].name
output_name = session.get_outputs()[0].name


@app.route('/', methods=['GET'])
def json_data():
    return f"<a href={url_for('static', filename='tfjs_effloc_model/model.json')}>file</a>"

@app.route('/onnx', methods=['GET'])
def json_data_onnx():   
    return send_from_directory(directory="static", filename = "tfjs_effloc_model/effloc.onnx")


@app.route("/predict", methods=["POST"])
def predict():
    if request.method == "POST":
        # Unpack img_data dict to get list of values
        img_data = request.get_json()

        # img_data as nparray with correct shape
        data_array = np.reshape(np.array(img_data, dtype=np.float32), (1, 4, 224, 224))

        # Run inferance on the data_array
        preds_reponse = session.run([output_name], {input_name: data_array})
        preds = preds_reponse[0].tolist()[0]

        # Add predictions to respose & add necessary headers
        resp = jsonify(preds)
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers["Content-Type"] = "application/json"
        return resp

if __name__ == '__main__':
    app.run( port="5000", debug=True)
