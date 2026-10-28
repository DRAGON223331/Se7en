import cv2
import numpy as np
import os

net = cv2.dnn.readNetFromONNX("u2netp.onnx")

def predict_mask(net, img_bgr, sz=320):
    h, w = img_bgr.shape[:2]
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    resized = cv2.resize(rgb, (sz, sz))
    resized = (resized - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])
    blob = np.transpose(resized, (2, 0, 1))[np.newaxis, ...].astype(np.float32)
    net.setInput(blob)
    out = net.forward()
    pred = out[0, 0]
    pred = (pred - pred.min()) / (pred.max() - pred.min() + 1e-8)
    mask = cv2.resize(pred, (w, h), interpolation=cv2.INTER_LINEAR)
    return mask

def process_rgba(img_bgr, crop_box=None, low=0.25, high=0.75, pad=16, manual_mask_cleanup=None):
    if crop_box is not None:
        x1, y1, x2, y2 = crop_box
        img_bgr = img_bgr[y1:y2, x1:x2]
    
    m1 = predict_mask(net, img_bgr, 320)
    m2 = predict_mask(net, img_bgr, 384)
    mask = (m1 + m2) / 2.0
    
    if manual_mask_cleanup:
        mask = manual_mask_cleanup(mask, img_bgr)
        
    mask = np.clip((mask - low) / (high - low), 0.0, 1.0)
    mask = cv2.GaussianBlur(mask, (3, 3), 0)
    
    b, g, r = cv2.split(img_bgr)
    a = (mask * 255).astype(np.uint8)
    rgba = cv2.merge([b, g, r, a])
    
    coords = cv2.findNonZero((a > 15).astype(np.uint8))
    if coords is not None:
        x, y, w, h = cv2.boundingRect(coords)
        img_h, img_w = rgba.shape[:2]
        nx1 = max(0, x - pad)
        ny1 = max(0, y - pad)
        nx2 = min(img_w, x + w + pad)
        ny2 = min(img_h, y + h + pad)
        rgba = rgba[ny1:ny2, nx1:nx2]
        
    return rgba

out_dir = "assets/products"
os.makedirs(out_dir, exist_ok=True)

# 1. Barcelona
img = cv2.imread("assets/originals/barcelona-contrast.jpg")
rgba = process_rgba(img)
cv2.imwrite(f"{out_dir}/barcelona-contrast.webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed barcelona-contrast")

# 2. Ahly Pharaonic
img = cv2.imread("assets/originals/al-ahly-pharaonic.jpg")
rgba = process_rgba(img)
cv2.imwrite(f"{out_dir}/al-ahly-pharaonic.webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed al-ahly-pharaonic")

# 3. Nile Developments
img = cv2.imread("assets/originals/nile-developments.jpg")
rgba = process_rgba(img)
cv2.imwrite(f"{out_dir}/nile-developments.webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed nile-developments")

# 4. Zamalek White Red
img = cv2.imread("assets/originals/zamalek-white-red.jpg")
rgba = process_rgba(img)
cv2.imwrite(f"{out_dir}/zamalek-white-red.webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed zamalek-white-red")

# 5. Ahly Black Gold
img = cv2.imread("assets/originals/al-ahly-black-gold.jpg")
rgba = process_rgba(img)
cv2.imwrite(f"{out_dir}/al-ahly-black-gold.webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed al-ahly-black-gold")

# 6. Ahly Red Classic
img = cv2.imread("assets/originals/al-ahly-red-classic.jpg")
rgba = process_rgba(img)
cv2.imwrite(f"{out_dir}/al-ahly-red-classic.webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed al-ahly-red-classic")

# 7. Brazil Ronaldo 9 (Front & Back)
# Note: Brazil Ronaldo original is 1086 wide, 1448 high.
# Top: Back (Ronaldo 9)
# Bottom: Front (Brasil 9)
img = cv2.imread("assets/originals/brazil-ronaldo9.jpg")
rgba_back = process_rgba(img, crop_box=(0, 0, 1086, 730))
rgba_front = process_rgba(img, crop_box=(0, 715, 1086, 1448))
cv2.imwrite(f"{out_dir}/brazil-ronaldo9-front.webp", rgba_front, [cv2.IMWRITE_WEBP_QUALITY, 92])
cv2.imwrite(f"{out_dir}/brazil-ronaldo9-back.webp", rgba_back, [cv2.IMWRITE_WEBP_QUALITY, 92])
# Also update the legacy name to the front view so anything referencing brazil-ronaldo9.webp gets the front!
cv2.imwrite(f"{out_dir}/brazil-ronaldo9.webp", rgba_front, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed brazil-ronaldo9 (front and back)")

# 8. Man Utd Black AIG (Front & Back)
# Original is 1448 wide, 1086 high.
# Left: Front (AIG)
# Right: Back (Ronaldo 7)
img = cv2.imread("assets/originals/man-utd-black-aig.jpg")
rgba_front = process_rgba(img, crop_box=(0, 0, 730, 1086))
rgba_back = process_rgba(img, crop_box=(718, 0, 1448, 1086))
cv2.imwrite(f"{out_dir}/man-utd-black-aig-front.webp", rgba_front, [cv2.IMWRITE_WEBP_QUALITY, 92])
cv2.imwrite(f"{out_dir}/man-utd-black-aig-back.webp", rgba_back, [cv2.IMWRITE_WEBP_QUALITY, 92])
cv2.imwrite(f"{out_dir}/man-utd-black-aig.webp", rgba_front, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed man-utd-black-aig (front and back)")

# 9. Man Utd Red AIG (Front & Back)
# Left: Front (AIG)
# Right: Back (Ronaldo 7)
img = cv2.imread("assets/originals/man-utd-red-aig.jpg")
rgba_front = process_rgba(img, crop_box=(0, 0, 730, 1086))
rgba_back = process_rgba(img, crop_box=(718, 0, 1448, 1086))
cv2.imwrite(f"{out_dir}/man-utd-red-aig-front.webp", rgba_front, [cv2.IMWRITE_WEBP_QUALITY, 92])
cv2.imwrite(f"{out_dir}/man-utd-red-aig-back.webp", rgba_back, [cv2.IMWRITE_WEBP_QUALITY, 92])
cv2.imwrite(f"{out_dir}/man-utd-red-aig.webp", rgba_front, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed man-utd-red-aig (front and back)")

# 10. Trabzonspor
img = cv2.imread("assets/originals/trabzonspor-black-blue.jpg")
rgba = process_rgba(img)
cv2.imwrite(f"{out_dir}/trabzonspor-black-blue.webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed trabzonspor-black-blue")

# 11. Real Madrid Black
img = cv2.imread("assets/originals/real-madrid-black.jpg")
rgba = process_rgba(img, low=0.3, high=0.7)
cv2.imwrite(f"{out_dir}/real-madrid-black.webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed real-madrid-black")

# 12. Batman Red
img = cv2.imread("assets/originals/batman-red.jpeg")
rgba = process_rgba(img)
cv2.imwrite(f"{out_dir}/batman-red.webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed batman-red")

# 13. Spider Black
img = cv2.imread("assets/originals/spider-black.jpeg")
rgba = process_rgba(img)
cv2.imwrite(f"{out_dir}/spider-black.webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed spider-black")

# 14. Spider Blue
img = cv2.imread("assets/originals/spider-blue.jpeg")
rgba = process_rgba(img, low=0.3, high=0.7)
cv2.imwrite(f"{out_dir}/spider-blue.webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed spider-blue")

# 15. Bag Navy
img = cv2.imread("assets/originals/bag-t60-navy-01.jpeg")
# Crop bottom watermark if any or process full
h, w = img.shape[:2]
rgba = process_rgba(img, crop_box=(0, 0, w, int(h * 0.95)))
cv2.imwrite(f"{out_dir}/bag-t60-navy.webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed bag-t60-navy")

# 16. Bag Red
img = cv2.imread("assets/originals/bag-t60-red.jpeg")
h, w = img.shape[:2]
rgba = process_rgba(img, crop_box=(0, 0, w, int(h * 0.95)))
cv2.imwrite(f"{out_dir}/bag-t60-red.webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed bag-t60-red")

# 17. Nike Bags
img = cv2.imread("assets/originals/nike-bags.jpg")
rgba = process_rgba(img)
cv2.imwrite(f"{out_dir}/nike-bags.webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, 92])
print("Processed nike-bags")

print("ALL ASSETS PROCESSED SUCCESSFULLY!")

