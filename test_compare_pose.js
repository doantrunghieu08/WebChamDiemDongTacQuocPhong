const standardData = {
    "frames": [
        {
            "frame_index": 0,
            "timestamp": 0,
            "angles": {
                "left_hip": 171.35, "left_knee": 164, "right_hip": 171.71, 
                "left_elbow": 155.26, "right_knee": 151.43, "right_elbow": 160.43, 
                "left_shoulder": 21.09, "right_shoulder": 20.56
            },
            "keypoints_3d": {
                "left_hip": [-0.0010, -0.0351, 0.0095], 
                "left_knee": [0.1449, -0.0289, 0.0412], 
                "right_hip": [0.0001, 0.0417, -0.0035], 
                "left_ankle": [0.2767, -0.0183, 0.0328], 
                "left_elbow": [-0.0850, -0.0926, -0.0162], 
                "left_wrist": [0.0099, -0.0864, 0.0458], 
                "right_knee": [0.1500, 0.0500, 0.0200],
                "right_ankle": [0.2800, 0.0400, 0.0300],
                "left_shoulder": [-0.1900, -0.0700, -0.0400],
                "right_shoulder": [-0.1800, 0.0800, -0.0500]
            }
        }
    ]
};

const studentData = {
    "frames": [
        {
            "frame_index": 0,
            "timestamp": 0,
            "angles": {
                "left_hip": 171.35, "left_knee": 164, "right_hip": 171.71, 
                "left_elbow": 155.26, "right_knee": 151.43, "right_elbow": 160.43, 
                "left_shoulder": 21.09, "right_shoulder": 20.56
            },
            "keypoints_3d": {
                "left_hip": [-0.0010, -0.0351, 0.0095], 
                "left_knee": [0.1449, -0.0289, 0.0412], 
                "right_hip": [0.0001, 0.0417, -0.0035], 
                "left_ankle": [0.2767, -0.0183, 0.0328], 
                "left_elbow": [-0.0850, -0.0926, -0.0162], 
                "left_wrist": [0.0099, -0.0864, 0.0458], 
                "right_knee": [0.1500, 0.0500, 0.0200],
                "right_ankle": [0.2800, 0.0400, 0.0300],
                "left_shoulder": [-0.1900, -0.0700, -0.0400],
                "right_shoulder": [-0.1800, 0.0800, -0.0500]
            }
        }
    ]
};

async function test() {
    try {
        const payload = { studentData, standardData: JSON.stringify(standardData) };
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
