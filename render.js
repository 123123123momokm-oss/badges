// render.js – draws one badge side from a saved template design + real employee data.
// Used by the approver preview now, and by printing later. Requires Konva (+ qrcode-generator for QR).
"use strict";
(function(){
  const PT = 0.3528; // mm per point
  const bidi = (t, dir) => (dir === "ltr" ? "\u2066" : "\u2067") + t + "\u2069";
  function rrPath(ctx, x, y, w, h, r){
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  }
  function loadImage(url){
    return new Promise((res) => {
      if(!url) return res(null);
      const im = new Image(); im.crossOrigin = "anonymous";
      im.onload = () => res(im); im.onerror = () => res(null); im.src = url;
    });
  }
  function qrCanvas(text){
    const c = document.createElement("canvas"); c.width = c.height = 400; const x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, 400, 400);
    try{
      const q = window.qrcode(0, "M"); q.addData(text || " "); q.make();
      const n = q.getModuleCount(), cell = 400 / (n + 2); x.fillStyle = "#000";
      for(let r = 0; r < n; r++) for(let k = 0; k < n; k++) if(q.isDark(r, k)) x.fillRect((k + 1) * cell, (r + 1) * cell, Math.ceil(cell), Math.ceil(cell));
    }catch(e){ x.fillStyle = "#000"; x.font = "bold 80px sans-serif"; x.textAlign = "center"; x.fillText("QR", 200, 220); }
    return c;
  }
  function valueOf(el, data){
    let v = String((data && data[el.field]) == null ? "" : data[el.field]);
    if(el.max_chars && v.length > el.max_chars) v = v.slice(0, el.max_chars - 1) + "…";
    return (el.prefix || "") + v;
  }
  function textNode(el, value, ppm){
    const w = el.w * ppm, hh = el.h * ppm; let size = el.size * PT * ppm;
    const style = el.bold ? "bold" : "normal", txt = bidi(value, el.dir), fam = '"' + el.font + '", sans-serif';
    if(el.type === "field" && el.shrink){
      const t = new Konva.Text({ text:txt, fontFamily:fam, fontStyle:style, fontSize:size });
      const min = size * ((el.min_pct || 60) / 100);
      while(t.getTextWidth() > w && size > min){ size -= 0.5; t.fontSize(size); }
    }
    return new Konva.Text({ width:w, height:hh, text:txt, fontFamily:fam, fontStyle:style, fontSize:size, fill:el.color, align:el.align, verticalAlign:"middle", wrap:"none" });
  }
  function photoNode(el, photo, ppm){
    if(!photo) return null;
    const w = el.w * ppm, hh = el.h * ppm, r = Math.min(el.radius * ppm, w / 2, hh / 2);
    const g = new Konva.Group({ width:w, height:hh, clipFunc:(ctx) => { ctx.beginPath(); rrPath(ctx, 0, 0, w, hh, r); ctx.closePath(); } });
    const iw = photo.naturalWidth || photo.width, ih = photo.naturalHeight || photo.height, ratio = w / hh; let crop;
    if(iw / ih > ratio){ const cw = ih * ratio; crop = { x:(iw - cw) / 2, y:0, width:cw, height:ih }; }
    else{ const ch = iw / ratio; crop = { x:0, y:(ih - ch) * ((el.focus || 0) / 100), width:iw, height:ch }; }
    g.add(new Konva.Image({ image:photo, width:w, height:hh, crop }));
    if(el.border_w > 0) g.add(new Konva.Rect({ width:w, height:hh, cornerRadius:r, stroke:el.border_color, strokeWidth:el.border_w * ppm * 2 }));
    return g;
  }
  function imageNode(el, imgs, ppm){
    const img = el.asset && imgs && imgs[el.asset]; if(!img) return null;
    const w = el.w * ppm, hh = el.h * ppm, cfg = { image:img, width:w, height:hh };
    if(el.fit === "contain"){ const r = Math.min(w / img.naturalWidth, hh / img.naturalHeight); cfg.width = img.naturalWidth * r; cfg.height = img.naturalHeight * r; cfg.x = (w - cfg.width) / 2; cfg.y = (hh - cfg.height) / 2; }
    const g = new Konva.Group({ width:w, height:hh }); g.add(new Konva.Image(cfg)); return g;
  }
  // o: { container, elements, widthMm, heightMm, ppm, scale, data, imgs }   data.photo = <img> for the employee photo
  function draw(o){
    const ppm = o.ppm || 12, scale = o.scale || 1, W = o.widthMm * ppm, H = o.heightMm * ppm;
    const stage = new Konva.Stage({ container:o.container, width:W * scale, height:H * scale });
    stage.scale({ x:scale, y:scale });
    const layer = new Konva.Layer(); stage.add(layer);
    layer.add(new Konva.Rect({ x:0, y:0, width:W, height:H, fill:"#ffffff", listening:false }));
    (o.elements || []).forEach((el) => {
      if(!el || el.hidden) return;
      let n = null;
      if(el.type === "image") n = imageNode(el, o.imgs, ppm);
      else if(el.type === "text") n = textNode(el, el.text || "", ppm);
      else if(el.type === "field") n = textNode(el, valueOf(el, o.data), ppm);
      else if(el.type === "photo") n = photoNode(el, o.data && o.data.photo, ppm);
      else if(el.type === "qr") n = new Konva.Image({ image:qrCanvas(o.data && o.data.verify_url), width:el.w * ppm, height:el.h * ppm });
      if(!n) return;
      n.setAttrs({ x:el.x * ppm, y:el.y * ppm, rotation:el.rot || 0, opacity:el.opacity == null ? 1 : el.opacity, listening:false });
      layer.add(n);
    });
    layer.draw();
    return stage;
  }
  window.BadgeRender = { draw, loadImage, qrCanvas };
})();
