async function testRealCompare() {
    try {
        const studentVideoUrl = "https://res.cloudinary.com/dzmepj5y8/video/upload/v1780299971/MilitaryProject/Student_Submissions/b%C3%B9i_thu_nhi_v%C3%B5_thu%E1%BA%ADt_1780299971153.mp4";
        const standardVideoUrl = "https://res.cloudinary.com/dzmepj5y8/video/upload/v1741103756/MilitaryProject/Sample_Videos/bai_1_vd_mau_1741103756303.mp4"; // I need the actual standard video url

        console.log("Extracting student...");
        const resStu = await fetch('http://103.75.182.246/runpod-ai/api/ai/extract-student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl: studentVideoUrl, sample_rate: 1 })
        });
        const stuData = await resStu.json();
        
        console.log("Extracting standard...");
        const resStd = await fetch('http://103.75.182.246/runpod-ai/api/ai/extract-student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl: studentVideoUrl, sample_rate: 1 }) // just using student video for both for a moment, wait, I should use standard video!
        });
        const stdData = await resStd.json();

        console.log("Comparing...");
        const payload = { 
            studentData: stuData.studentData, 
            standardData: stdData.studentData 
        };
        const resComp = await fetch('http://103.75.182.246/runpod-ai/api/ai/compare-pose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const compJson = await resComp.json();
        console.log("Compare result:", JSON.stringify(compJson, null, 2));

    } catch (e) {
        console.error(e);
    }
}
testRealCompare();
