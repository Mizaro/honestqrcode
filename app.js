document.getElementById('generateBtn').addEventListener('click', () => {
  const output = document.getElementById('qr-output');
  const content = document.getElementById('content').value.trim();

  if (!content) {
    alert('Please enter content');
    return;
  }

  output.innerHTML = '';

  new QRCode(output, {
    text: content,
    width: 256,
    height: 256
  });
});
