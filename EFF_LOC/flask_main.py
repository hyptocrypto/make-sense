from flask import Flask, request, Response, json, url_for, send_from_directory
from flask_cors import CORS
import os
import re 
import subprocess

app = Flask(__name__)
CORS(app)


@app.route('/', methods=['GET'])
def json_data():
    return f"<a href={url_for('static', filename='tfjs_effloc_model/model.json')}>file</a>"

@app.route('/onnx', methods=['GET'])
def json_data_onnx():
   # return f"<a href={url_for('static', filename='tfjs_effloc_model/effloc.onnx')}>file</a>"
    return send_from_directory("static/tfjs_effloc_model/effloc.onnx")
if __name__ == '__main__':
    app.run( port="5000", debug=True)
