const express = require("express");
const fs = require("fs");
const path = require("path");
const AWS = require("aws-sdk");
const ffmpeg = require("fluent-ffmpeg");
const dotenv = require("dotenv");
dotenv.config({ path: `.env` });
const app = express();
app.use(express.json());
const port = 8000;

const s3 = new AWS.S3({
  accessKeyId: "**",
  secretAccessKey: "**",
  region: "us-east-1",
});
const BUCKET_NAME = process.env.BUCKET_NAME || "coderdg.com";
const CLOUD_FRONT_URL =
  process.env.CLOUD_FRONT_URL ||
  "https://s3.us-east-1.amazonaws.com/coderdg.com";

// Function to generate thumbnail from video URL
const generateThumbnail = async (videoUrl, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(videoUrl)
      .screenshots({
        count: 1,
        folder: path.dirname(outputPath),
        filename: path.basename(outputPath),
        size: "320x180",
      })
      .on("end", () => {
        resolve(outputPath);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

// Function to upload file to S3
const uploadToS3 = async (filePath, bucketName, s3Key) => {
  const fileContent = fs.readFileSync(filePath);
  const params = {
    Bucket: bucketName,
    Key: s3Key,
    Body: fileContent,
    ContentType: "image/jpeg",
  };

  return s3.upload(params).promise();
};

app.post("/generate-thumbnail", async (req, res) => {
  const { video_url, file_name } = req.body;
  if (!video_url || !file_name) {
    return res.status(500).json({
      message: "Error generating/uploading thumbnail",
    });
  }
  const outputPath = path.join(__dirname, file_name.split("/")[1]);

  try {
    await generateThumbnail(video_url, outputPath);
    console.log("Thumbnail generated");

    // Upload the generated thumbnail to S3
    const uploadResponse = await uploadToS3(
      outputPath,
      BUCKET_NAME,
      `thumbnails/${file_name}`
    );
    console.log("Thumbnail uploaded to S3", uploadResponse);

    res.status(200).json({
      message: "Thumbnail generated and uploaded",
      s3Url: uploadResponse.Location,
    });

    fs.unlinkSync(outputPath);
  } catch (error) {
    console.error("Error generating/uploading thumbnail:", error);
    return res.status(500).json({
      message: "Error generating/uploading thumbnail",
      error: error.message,
    });
  }
});
app.get("/", (req, res) => {
  res.send({
    message: `Service is running`,
  });
});
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${port}`);
});
