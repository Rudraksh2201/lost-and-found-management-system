const ort = require('onnxruntime-node');

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

async function load(modelPath) {
  const session = await ort.InferenceSession.create(modelPath);
  return { session };
}

function iou(a, b) {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[0] + a[2], b[0] + b[2]), y2 = Math.min(a[1] + a[3], b[1] + b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const u = a[2] * a[3] + b[2] * b[3] - inter;
  return u > 0 ? inter / u : 0;
}

function nms(boxes, thresh) {
  boxes.sort((a, b) => b.score - a.score);
  const keep = [];
  while (boxes.length) {
    const best = boxes.shift();
    keep.push(best);
    boxes = boxes.filter(b => iou(best.box, b.box) < thresh);
  }
  return keep;
}

const COCO = ['person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse',
  'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie',
  'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
  'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon',
  'bowl', 'banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut',
  'cake', 'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book',
  'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'];

async function detect(model, imagePath, confThresh) {
  const sharp = require('sharp');
  const meta = await sharp(imagePath).metadata();
  const { data, info } = await sharp(imagePath)
    .resize({ width: 640, height: 640, fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const rgb = new Float32Array(640 * 640 * 3);
  for (let p = 0; p < 640 * 640; p++) {
    rgb[p] = data[p * channels] / 255;
    rgb[640 * 640 + p] = data[p * channels + 1] / 255;
    rgb[2 * 640 * 640 + p] = data[p * channels + 2] / 255;
  }

  const inputName = model.session.inputNames[0] || 'images';
  const outputName = model.session.outputNames[0] || 'output0';
  const input = new ort.Tensor('float32', rgb, [1, 3, 640, 640]);
  const outputs = await model.session.run({ [inputName]: input });
  const out = outputs[outputName];
  const dims = out.dims;
  const data0 = out.data;

  let channelsFirst = true;
  let numCols = 8400;
  if (dims[1] === 8400) numCols = 8400;
  else if (dims[1] === 84) { numCols = 8400; channelsFirst = true; }
  if (dims.length === 3 && dims[2] === 84 && dims[1] !== 84) { numCols = dims[1]; channelsFirst = false; }
  const numClasses = channelsFirst ? dims[1] - 4 : 84 - 4;
  const rows = numCols;
  const cols = channelsFirst ? dims[1] : 84;

  const at = (ch, a) => channelsFirst ? data0[ch * numCols + a] : data0[a * cols + ch];

  const xScale = meta.width / 640;
  const yScale = meta.height / 640;

  const boxes = [];
  for (let a = 0; a < rows; a++) {
    const cx = at(0, a), cy = at(1, a), w = at(2, a), h = at(3, a);
    let best = -1, bestScore = -Infinity;
    for (let c = 4; c < 4 + numClasses; c++) {
      const s = sigmoid(at(c, a));
      if (s > bestScore) { bestScore = s; best = c - 4; }
    }
    if (bestScore > confThresh) {
      boxes.push({
        class: best,
        score: bestScore,
        box: [(cx - w / 2) * xScale, (cy - h / 2) * yScale, w * xScale, h * yScale]
      });
    }
  }

  return nms(boxes, 0.45).slice(0, 5).map(k => ({
    class: COCO[k.class] || `class_${k.class}`,
    score: k.score,
    box: k.box.map(v => Number(v.toFixed(1)))
  }));
}

module.exports = { load, detect };