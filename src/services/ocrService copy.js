const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");
const pdfPoppler = require("pdf-poppler");
// const { convert } = require("pdf-poppler");

class OCRService {
  constructor() {
    this.uploadDir = path.join(__dirname, "../../uploads");
    this.tempDir = path.join(__dirname, "../../temp");
    this.outputDir = path.join(__dirname, "../../images"); // Folder for images

    // Ensure directories exist
    [this.uploadDir, this.tempDir, this.outputDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Validate poppler installation
    this.validatePopplerInstallation();
  }

  validatePopplerInstallation() {
    const popplerPath =
      process.env.POPPLER_PATH?.trim() ||
      "C:\\Program Files\\poppler-24.08.0\\Library\\bin";
    const pdftoppmPath = path.join(popplerPath, "pdftoppm.exe");

    if (!fs.existsSync(pdftoppmPath)) {
      console.error("Poppler installation not found at:", pdftoppmPath);
      console.error(
        "Please ensure poppler is installed and POPPLER_PATH is set correctly in .env file"
      );
      throw new Error("Poppler installation not found");
    }
  }

  async extractTextFromImage(imagePath) {
    try {
      const {
        data: { text },
      } = await Tesseract.recognize(imagePath, "eng");
      return text;
    } catch (error) {
      console.error("OCR error:", error);
      throw new Error("Failed to extract text from image");
    }
  }

  async convertPDFToImages(pdfPath) {
    try {
      // Verify file exists and is readable
      await fs.promises.access(pdfPath, fs.constants.R_OK);
      console.log("PDF file exists and is readable:", pdfPath);

      // Create a unique subdirectory for this conversion
      const uniqueDir = path.join(this.tempDir, Date.now().toString());
      await fs.promises.mkdir(uniqueDir, { recursive: true });

      // Configure options according to pdf-poppler's requirements
      const opts = {
        format: "png",
        outdir: uniqueDir,
        prefix: "page",
        scale: 2.0,
        page: null,
      };

      // Set the poppler path if available
      if (process.env.POPPLER_PATH) {
        process.env.POPPLER_BIN_PATH = process.env.POPPLER_PATH.trim();
      }

      console.log("Converting PDF with options:", opts);
      // Use the convert function directly
      await convert(pdfPath, opts);

      // Get list of generated images
      const files = await fs.promises.readdir(uniqueDir);
      const images = files
        .filter((f) => f.endsWith(".png"))
        .sort((a, b) => {
          // Ensure proper page order
          const numA = parseInt(a.match(/\d+/)[0]);
          const numB = parseInt(b.match(/\d+/)[0]);
          return numA - numB;
        })
        .map((f) => path.join(uniqueDir, f));

      console.log("Generated images:", images);
      return images;
    } catch (error) {
      console.error("PDF conversion error details:", {
        error: error.message,
        stack: error.stack,
        pdfPath,
        tempDir: this.tempDir,
        popplerPath: process.env.POPPLER_PATH,
      });
      throw new Error(`Failed to convert PDF to images: ${error.message}`);
    }
  }

  async cleanupTempFiles(images) {
    try {
      for (const image of images) {
        await fs.promises.unlink(image);
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  }

  processExtractedText(text) {
    const buyerMatch =
      text.match(/BUYER.*?:\s*(.*?)(?=\n|$)/i) ||
      text.match(/PURCHASER.*?:\s*(.*?)(?=\n|$)/i);
    const sellerMatch = text.match(/SELLER.*?:\s*(.*?)(?=\n|$)/i);
    const propertyMatch =
      text.match(/PROPERTY TO BE SOLD.*?:\s*(.*?)(?=\n|$)/i) ||
      text.match(/The property.*?is known as\s*(.*?)(?=\n|$)/i);
    const priceMatch =
      text.match(/purchase price.*?\$(\d+,\d+)/i) || text.match(/\$(\d+,\d+)/i);
    const dateMatch = text.match(/key date.*?:\s*(.*?)(?=\n|$)/i);

    return {
      buyerName: buyerMatch ? buyerMatch[1].trim() : "Not Found",
      sellerName: sellerMatch ? sellerMatch[1].trim() : "Not Found",
      propertyAddress: propertyMatch ? propertyMatch[1].trim() : "Not Found",
      offerPrice: priceMatch ? `$${priceMatch[1]}` : "Not Found",
      keyDates: dateMatch ? dateMatch[1].trim() : "Not Found",
    };
  }

  async processDocument(filePath) {
    try {
      fs.readdir(this.uploadDir, (err, files) => {
        if (err) return console.error("Error reading directory:", err);

        const pdfFiles = files.filter((file) => file.endsWith(".pdf"));
        pdfFiles.forEach((pdf) =>
          this.convertPDF(path.join(this.uploadDir, pdf))
        );
      });

      // console.log("Starting document processing...");
      // console.log("Input file path:", filePath);

      // console.log("Converting PDF to images...");
      // const images = await this.convertPDFToImages(filePath);

      // console.log(`Processing ${images.length} pages...`);
      // let extractedText = "";

      // for (const imagePath of images) {
      //   console.log(`Processing page: ${imagePath}`);
      //   extractedText += (await this.extractTextFromImage(imagePath)) + "\n";
      // }

      // // Clean up temporary image files
      // await this.cleanupTempFiles(images);

      // return this.processExtractedText(extractedText);
    } catch (error) {
      console.error("Document processing error:", error);
      throw error;
    }
  }

  async convertPDF(pdfPath) {
    const opts = {
      format: "png",
      out_dir: this.outputDir,
      out_prefix: path.basename(pdfPath, path.extname(pdfPath)),
      density: 1200, // Higher DPI improves clarity
      scale: 1200, // Higher scale for better resolution
    };

    try {
      await pdfPoppler.convert(pdfPath, opts);
      console.log(`Converted: ${pdfPath}`);
    } catch (err) {
      console.error(`Error converting ${pdfPath}:`, err);
    }
  }
}

module.exports = new OCRService();
