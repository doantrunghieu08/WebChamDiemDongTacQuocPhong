async function test() {
    try {
        const payload = { 
            studentData: { frames: [{frame_index: 0, timestamp: 0, angles: {}, keypoints_3d: {}}] }, 
            standardData: { frames: [] } 
        };
        const res = await fetch('http://103.75.182.246/runpod-ai/api/ai/compare-pose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        console.log("Response:", JSON.stringify(json, null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
