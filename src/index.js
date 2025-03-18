require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ocrService = require("./services/ocrService");

const app = express();
const port = process.env.PORT || 3000;

// Set EJS as the templating engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    console.log("Received file:", {
      fieldname: file.fieldname,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });

    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed!"));
    }
  },
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.render("upload", { result: null }); // Render the upload page with no result initially
});

// OCR endpoint
app.post("/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
        message: 'Please upload a PDF file using the field name "file"',
      });
    }

    console.log("Processing file:", req.file.path);
    const result = await ocrService.processDocument(req.file.path);
    
    // Delete the uploaded file after processing
    fs.unlink(req.file.path, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
      } else {
        console.log("Uploaded file deleted successfully.");
      }
    });

    res.render("upload", { result }); // Render the upload page with OCR data
  } catch (error) {
    console.error("Error processing document:", error);
    res.status(500).json({
      error: "Failed to process document",
      details: error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: "File upload error",
      message: err.message,
      field: err.field,
    });
  }
  res.status(500).json({
    message: "Something went wrong!",
    error: err.message,
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
