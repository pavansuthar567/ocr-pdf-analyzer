const fs = require("fs");
const path = require("path");
const pdfPoppler = require("pdf-poppler");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const { HfInference } = require("@huggingface/inference");

const hf = new HfInference(process.env.HF_API_KEY); // Use your Hugging Face API key

class OCRService {
  constructor() {
    this.uploadDir = path.join(__dirname, "../../uploads");
    this.outputDir = path.join(__dirname, "../../images");
    [this.uploadDir, this.outputDir].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
    this.validatePopplerInstallation();
  }

  validatePopplerInstallation() {
    const popplerPath = process.env.POPPLER_PATH?.trim();
    const pdftoppmPath = path.join(popplerPath, "pdftoppm.exe");
    if (!fs.existsSync(pdftoppmPath)) {
      throw new Error("Poppler not found. Set correct path in .env.");
    }
  }

  async preprocessImage(imagePath) {
    const processedPath = imagePath.replace(".png", "-processed.png");
    await sharp(imagePath).grayscale().normalize().toFile(processedPath);
    return processedPath;
  }

  async extractTextFromImage(imagePath) {
    const processedImage = await this.preprocessImage(imagePath);
    const {
      data: { text },
    } = await Tesseract.recognize(processedImage, "eng");
    return text;
  }

  async extractAllText(imagePaths) {
    let fullText = "";
    for (const imagePath of imagePaths) {
      fullText += (await this.extractTextFromImage(imagePath)) + "\n";
    }
    return fullText;
  }

  // async extractEntitiesWithHuggingFace(text) {
  //   try {
  //     const response = await hf.tokenClassification({
  //       model: "dslim/bert-base-NER", // Hugging Face's Named Entity Recognition model
  //       inputs: text,
  //     });

  //     let entities = {
  //       buyerName: "Not Found",
  //       sellerName: "Not Found",
  //       propertyAddress: "Not Found",
  //       offerPrice: "Not Found",
  //       keyDates: "Not Found",
  //     };

  //     console.log('response', response)

  //     response.forEach((entity) => {
  //       if (
  //         entity.label.includes("PERSON") &&
  //         entities.buyerName === "Not Found"
  //       ) {
  //         entities.buyerName = entity.word;
  //       } else if (
  //         entity.label.includes("ORG") &&
  //         entities.sellerName === "Not Found"
  //       ) {
  //         entities.sellerName = entity.word;
  //       } else if (
  //         entity.label.includes("LOC") &&
  //         entities.propertyAddress === "Not Found"
  //       ) {
  //         entities.propertyAddress = entity.word;
  //       } else if (
  //         entity.label.includes("MONEY") &&
  //         entities.offerPrice === "Not Found"
  //       ) {
  //         entities.offerPrice = entity.word;
  //       } else if (
  //         entity.label.includes("DATE") &&
  //         entities.keyDates === "Not Found"
  //       ) {
  //         entities.keyDates = entity.word;
  //       }
  //     });

  //     return entities;
  //   } catch (error) {
  //     console.error("Hugging Face API Error:", error);
  //     return {
  //       buyerName: "Error",
  //       sellerName: "Error",
  //       propertyAddress: "Error",
  //       offerPrice: "Error",
  //       keyDates: "Error",
  //     };
  //   }
  // }

  async extractEntitiesWithHuggingFace(text) {
    try {
      const response = await hf.tokenClassification({
        model: "dslim/bert-base-NER",
        inputs: text,
      });

      let entities = {
        buyerName: "Not Found",
        sellerName: "Not Found",
        propertyAddress: "Not Found",
        offerPrice: "Not Found",
        keyDates: "Not Found",
      };

      // Regex fallbacks
      const buyerMatch = text.match(/^(\w+)\s+to seller/i);
      if (buyerMatch) {
        entities.buyerName = buyerMatch[1].trim();
      }
      const priceMatch = text.match(/\$\s*([\d,]+)/);
      if (priceMatch) {
        entities.offerPrice = "$" + priceMatch[1].trim();
      }
      const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (dateMatch) {
        entities.keyDates = dateMatch[1].trim();
      }
      const propMatch = text.match(
        /is known as\s*([^,]+,\s*[^,]+,\s*[^,]+,\s*\d+)/i
      );
      if (propMatch) {
        entities.propertyAddress = propMatch[1].trim();
      }
      const sellerMatch = text.match(/Seller\(s\)\s*is\/are_([\w]+)/i);
      if (sellerMatch) {
        entities.sellerName = sellerMatch[1].trim();
      }

      // Process HF NER results for any missing fields
      response.forEach((entity) => {
        const label = entity.entity_group || entity.label || "";
        if (label.includes("PER") && entities.buyerName === "Not Found") {
          entities.buyerName = entity.word;
        }
        if (label.includes("ORG") && entities.sellerName === "Not Found") {
          entities.sellerName = entity.word;
        }
        if (label.includes("LOC") && entities.propertyAddress === "Not Found") {
          entities.propertyAddress = entity.word;
        }
        if (label.includes("MONEY") && entities.offerPrice === "Not Found") {
          entities.offerPrice = entity.word;
        }
        if (label.includes("DATE") && entities.keyDates === "Not Found") {
          entities.keyDates = entity.word;
        }
      });

      return entities;
    } catch (error) {
      console.error("Hugging Face API Error:", error);
      return {
        buyerName: "Error",
        sellerName: "Error",
        propertyAddress: "Error",
        offerPrice: "Error",
        keyDates: "Error",
      };
    }
  }

  async processDocument(pdfPath) {
    try {
      const images = await this.convertPDF(pdfPath);
      const extractedText = await this.extractAllText(images);
      return await this.extractEntitiesWithHuggingFace(extractedText);
    } catch (error) {
      throw new Error("Failed to process document.");
    }
  }

  async convertPDF(pdfPath) {
    const opts = {
      format: "png",
      out_dir: this.outputDir,
      out_prefix: path.basename(pdfPath, path.extname(pdfPath)),
      density: 1200,
      scale: 1200,
    };

    try {
      await pdfPoppler.convert(pdfPath, opts);
      return fs
        .readdirSync(this.outputDir)
        .map((f) => path.join(this.outputDir, f));
    } catch (err) {
      throw new Error(`Error converting PDF: ${err.message}`);
    }
  }
}

module.exports = new OCRService();
