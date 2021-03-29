import random
from locust import HttpUser, task, between
import json
import os
import numpy as np


data = [0.132]*(224*224*4)
target_ip = 'http://54.157.122.103:80'


class Load_tester(HttpUser):
    @task
    def inferance_endpoint(self):
        response = self.client.post(
            f"{target_ip}/predict", data=json.dumps(data), headers={"content-type": "application/json"})
        print(response.status_code)
