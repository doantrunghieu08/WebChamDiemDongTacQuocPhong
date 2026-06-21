

async function test() {
    try {
        const payload = {
            videoUrl: "https://res.cloudinary.com/dzmepj5y8/video/upload/v1780299971/MilitaryProject/Student_Submissions/b%C3%B9i_thu_nhi_v%C3%B5_thu%E1%BA%ADt_1780299971153.mp4",
            sample_rate: 1
        };
        const res = await fetch('http://103.75.182.246/runpod-ai/api/ai/extract-student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        console.log("extract-student frames count:", json.studentData.frames.length);
        console.log("extract-student first frame:", JSON.stringify(json.studentData.frames[0], null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
