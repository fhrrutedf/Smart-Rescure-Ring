import http from "http";

function checkDetections() {
  http.get("http://localhost:5000/api/dashboard", (res) => {
    let data = "";
    res.on("data", (chunk) => { data += chunk; });
    res.on("end", () => {
      console.log("=== LATEST DETECTIONS ===");
      try {
        const detections = JSON.parse(data);
        if (detections.length === 0) {
            console.log("No detections in log yet.");
        } else {
            console.log(JSON.stringify(detections, null, 2));
        }
      } catch {
        console.log("RAW DATA:", data);
      }
      console.log("=========================");
    });
  }).on("error", (err) => {
    console.error("Error fetching detections:", err.message);
  });
}

checkDetections();
