const http = require('http');

function post(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(data);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    console.log("--- Testing evaluate-pairwise-vlm with camelCase videoUrl ---");
    const resCamel = await post('http://103.75.182.246/runpod-ai/api/ai/evaluate-pairwise-vlm', {
      standardData: { frames: [], videoUrl: 'http://example.com/standard.mp4' },
      studentData: { frames: [], videoUrl: 'http://example.com/student.mp4' },
      scores: {}
    });
    console.log("Status:", resCamel.statusCode);
    console.log("Body:", resCamel.body);

    console.log("\n--- Testing evaluate-pairwise-vlm with snake_case video_url ---");
    const resSnake = await post('http://103.75.182.246/runpod-ai/api/ai/evaluate-pairwise-vlm', {
      standardData: { frames: [], video_url: 'http://example.com/standard.mp4' },
      studentData: { frames: [], video_url: 'http://example.com/student.mp4' },
      scores: {}
    });
    console.log("Status:", resSnake.statusCode);
    console.log("Body:", resSnake.body);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
