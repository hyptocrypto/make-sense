from flask import Flask, request, Response, json, url_for
from flask_cors import CORS
import os
import re 
import subprocess

app = Flask(__name__)
CORS(app)


@app.route('/', methods=['GET'])
def json_data():
    return f"<a href={url_for('static', filename='tfjs_effloc_model/model.json')}>file</a>"


if __name__ == '__main__':
    # GET HOST MACHINE LOCAL IP
    cmd = 'ifconfig | grep 192'
    inet = subprocess.check_output(cmd, shell=True)
    ip = re.search('(\s192.[0-9]*.[0-9]*.[0-9]*.\s)', inet.decode("utf-8")).group().strip()    
   
    app.run(host=ip, port="5000", debug=True)
