import base64
from io import BytesIO

import numpy as np
import torch
from PIL import Image
from facenet_pytorch import InceptionResnetV1, MTCNN

_mtcnn = None
_resnet = None


def get_device():
    return torch.device('cuda' if torch.cuda.is_available() else 'cpu')


def get_mtcnn():
    global _mtcnn
    if _mtcnn is None:
        _mtcnn = MTCNN(image_size=160, margin=0, keep_all=False, post_process=True, device=get_device())
    return _mtcnn


def get_resnet():
    global _resnet
    if _resnet is None:
        _resnet = InceptionResnetV1(pretrained='vggface2').eval().to(get_device())
    return _resnet


def decode_base64_image(data_url):
    if data_url.startswith('data:'):
        header, encoded = data_url.split(',', 1)
    else:
        encoded = data_url
    image_data = base64.b64decode(encoded)
    return Image.open(BytesIO(image_data)).convert('RGB')


def compute_embedding_from_base64(data_url):
    image = decode_base64_image(data_url)
    mtcnn = get_mtcnn()
    face_tensor = mtcnn(image)
    if face_tensor is None:
        return None
    face_tensor = face_tensor.to(get_device())
    with torch.no_grad():
        embedding = get_resnet()(face_tensor.unsqueeze(0))
    return embedding[0].cpu().numpy().tolist()


def cosine_similarity(vec1, vec2):
    v1 = np.array(vec1, dtype=np.float32)
    v2 = np.array(vec2, dtype=np.float32)
    if np.linalg.norm(v1) == 0 or np.linalg.norm(v2) == 0:
        return 0.0
    return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))


def is_live_sequence(frame_batches, motion_threshold=10.0):
    if not frame_batches or len(frame_batches) < 2:
        return False

    mtcnn = get_mtcnn()
    centers = []

    for frame in frame_batches:
        image = decode_base64_image(frame)
        boxes, _ = mtcnn.detect(image)
        if boxes is None or len(boxes) == 0:
            return False
        box = boxes[0]
        center = ((box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0)
        centers.append(center)

    motion = 0.0
    for i in range(1, len(centers)):
        prev = np.array(centers[i - 1])
        curr = np.array(centers[i])
        motion += np.linalg.norm(curr - prev)

    return motion >= motion_threshold
