const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  connectionLimit: 2, // optional
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});


app.get('/health', (req, res) => {
  res.send('Server is running');
});



app.get('/mysql-health', (req, res) => {
  // Get a connection from the pool
  db.getConnection((err, connection) => {
    if (err) {
      // If there's an error connecting to the DB, respond with an error
      return res.status(500).send('MySQL Database is down!');
    }

    // If connection was successful, release the connection back to the pool
    connection.release();

    // Respond with success if the connection was successful
    res.status(200).send('MySQL Database is up and running!');
  });
});





// Fetch all projects along with their images
app.get('/projects', (req, res) => {
  const query = `
    SELECT p.*, pi.image_url
    FROM projects p
    LEFT JOIN project_images pi ON p.id = pi.project_id
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err });

    // Group images by project id
    const projects = results.reduce((acc, row) => {
      const { id, title, description, thumbnail_url, video_id, content, project_link, image_url } = row;

      // Check if the project already exists in the accumulator
      if (!acc[id]) {
        acc[id] = {
          id,
          title,
          description,
          thumbnail_url,
          video_id,
          content,
          project_link, // ✅ include it here
          images: []
        };
      }
      
      // If there is an image_url, push it into the images array
      if (image_url) {
        acc[id].images.push(image_url);
      }

      return acc;
    }, {});

    // Convert the accumulator object to an array
    const projectsArray = Object.values(projects);
    res.json(projectsArray);
  });
});

app.get('/skills', (req, res) => {
  db.query('SELECT * FROM skills', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

app.get('/education', (req, res) => {
  db.query('SELECT * FROM education', (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});


// Fetch internship data
app.get('/internships', (req, res) => {
  const sql = 'SELECT * FROM internships ORDER BY start_date DESC';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});


// Contact form submission endpoint
app.post('/contact', (req, res) => {
  const { name, email, message } = req.body;

  // Insert into the contact table
  const sql = 'INSERT INTO contact (name, email, message) VALUES (?, ?, ?)';
  db.query(sql, [name, email, message], (err) => {
    if (err) return res.status(500).json({ error: err });

    // Send an email notification
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Change this to any other email if needed
      subject: 'New Contact Form Submission',
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ error: 'Failed to send email' });
      }
      res.status(200).json({ message: 'Message sent successfully!' });
    });
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
