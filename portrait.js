/* A deliberately illustrated effect, not a measure of intoxication. */
(function () {
  const captions = ['Tu cara de recién llegar', 'Todo en orden', 'Una sonrisa de más', 'La ceja va por libre', 'Modo caricatura', 'La gravedad hace lo suyo', 'Se cierran las persianas', 'Fuera de servicio… Zzz'];
  window.drawBeerPortrait = function (canvas, image, count) {
    const n = BeerRecognition.portraitStage(count), ctx = canvas.getContext('2d');
    const side = canvas.width;
    ctx.clearRect(0, 0, side, side);
    ctx.save(); ctx.scale(side / 192, side / 192);
    ctx.fillStyle = '#eedeb6'; ctx.fillRect(0, 0, 192, 192);
    ctx.save(); ctx.translate(96, 96); ctx.rotate([0, 0, -.025, .055, -.08, .12, .16, .2][n]); ctx.translate(-96, -96);
    if (image) {
      for (let y = 0; y < 192; y++) {
        const shift = n < 2 ? 0 : Math.sin((y - 75) / 24) * (n - 1) * 1.5;
        ctx.drawImage(image, 0, y, 192, 1, shift, y, 192, 1.4);
      }
    } else {
      ctx.fillStyle = '#f8c966'; ctx.beginPath();ctx.arc(96, 103, 70, 0, Math.PI * 2);ctx.fill();
      ctx.strokeStyle = '#224439';ctx.lineWidth = 5;ctx.lineCap = 'round';
      for (const x of [68, 124]) { ctx.beginPath();ctx.arc(x, 83, 4, 0, Math.PI * 2);ctx.stroke(); }
      ctx.beginPath();ctx.arc(96, 109, 28, .15, Math.PI - .15);ctx.stroke();
    }
    if (n >= 2) for (const x of [51, 141]) {
      const glow = ctx.createRadialGradient(x, 119, 1, x, 119, 27);
      glow.addColorStop(0, `rgba(238,93,92,${.16 + n * .065})`);glow.addColorStop(1, 'rgba(238,93,92,0)');
      ctx.fillStyle = glow;ctx.fillRect(x - 27, 92, 54, 54);
    }
    if (n >= 3 && n < 6) {
      ctx.strokeStyle = '#263e32';ctx.lineWidth = 5;ctx.lineCap = 'round';
      ctx.beginPath();ctx.moveTo(47, 62);ctx.quadraticCurveTo(62, 48 - n, 78, 58);ctx.stroke();
    }
    if (n >= 6) {
      // A sleep mask makes closed eyes readable even with an imperfectly centred photo.
      ctx.fillStyle = n === 7 ? '#244d48' : '#dec48c';
      ctx.beginPath();ctx.roundRect(29, 67, 134, 45, 17);ctx.fill();
      ctx.strokeStyle = n === 7 ? '#f6d785' : '#284d42';ctx.lineWidth = 4;ctx.lineCap = 'round';
      for (const x of [65, 127]) { ctx.beginPath();ctx.moveTo(x - 12, 86);ctx.quadraticCurveTo(x, n === 7 ? 100 : 92, x + 12, 86);ctx.stroke(); }
      if (n === 7) {ctx.fillStyle = '#294338';ctx.beginPath();ctx.ellipse(100, 139, 9, 12, 0, 0, Math.PI * 2);ctx.fill();}
    }
    ctx.restore();
    if (n === 5) {ctx.font = 'bold 26px sans-serif';ctx.fillStyle = '#fff7d7';ctx.fillText('✦', 143, 35);}
    if (n === 7) {
      ctx.fillStyle = '#fff6d4';ctx.strokeStyle = '#224b42';ctx.lineWidth = 3;
      for (const [text, x, y, size] of [['z', 134, 57, 18], ['z', 150, 39, 23], ['Z', 164, 21, 26]]) {
        ctx.font = `bold ${size}px sans-serif`;ctx.strokeText(text, x, y);ctx.fillText(text, x, y);
      }
    }
    ctx.restore();canvas.setAttribute('aria-label', captions[n]);
    return captions[n];
  };
})();
