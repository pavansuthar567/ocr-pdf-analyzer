const { spawn } = require("child_process");
const path = require("path");

class OCRService {
  processDocument(pdfPath) {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn("python", [
        path.join(__dirname, "ocr_processor.py"),
        pdfPath,
      ]);

      let dataString = "";
      pythonProcess.stdout.on("data", (data) => {
        dataString += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        console.error("Python stderr:", data.toString());
      });

      pythonProcess.on("close", (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(dataString);
            resolve(result);
          } catch (e) {
            reject(new Error("Failed to parse Python output"));
          }
        } else {
          reject(new Error("Python process exited with code " + code));
        }
      });
    });
  }
}

module.exports = new OCRService();
