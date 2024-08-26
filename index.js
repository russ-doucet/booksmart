import bodyParser from "body-parser";
import express from "express";
import axios from "axios";
import pg from "pg";

// Initializing our application object
const app = express();
// Defining port to host server on
const port = 3000;
// Initializing array to hold all of the returned search results
let searchArr = [];
let currentBook = {};
let postedBook = {};
let bookID = 1;

const db = new pg.Client({
    user:"postgres",
    host:"localhost",
    database:"books",
    password:"xwy32dawg!",
    port: 5432
  });

  db.connect();

// Mounting middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
    // Render the home page with an returned search results
    res.render("index.ejs", {results: searchArr});
});

// Handling the search for a specific title
app.post("/search", async (req, res) => {
    const searchTerm = req.body["book_query"];
    console.log(searchTerm);
    try{
        /* Creating a request to the open library api using the clients search input as a query. Limiting the 
        results to the 10 most relevant for aesthetic purposes, this can be changed as one sees fit.*/
        const response = await axios(`https://openlibrary.org/search.json?q=${searchTerm}&limit=10`);
        const req_docs = response.data.docs;
        //Looping through the API response and collecting the top 10 book titles and their id #'s
        req_docs.forEach((book) => {
            searchArr.push({
                title: book.title,
                author: book.author_name[0],
                cover_id: book.cover_i
            });
        });
        console.log(req_docs);
        res.redirect("/");
    } catch(error){
        res.status(500).json({message: "Error fetching book info."});
    }
});

app.post("/review", (req, res) => {
    // DEBUGGING PURPOSES
    // console.log(req.body.hiddenID);
    // console.log(searchArr);

    // Retrieve the id of the book selected to be reviewed
    const selectedID = parseInt(req.body["hiddenID"]);
    // Parse our array of searches to match title and author to selected id
    currentBook = searchArr.find((book) => {
        //console.log(book.cover_id); 
         return book.cover_id === selectedID; 
    });

    // Clearing searchArr for user's next query
    searchArr = [];
    // Render the 'Create a Review' page with the respective book's information
    res.render("review.ejs", { selectedBook: currentBook });

});

app.post("/create", async (req, res) => {
    const postTitle = req.body["reviewTitle"];
    const postBody = req.body["reviewBody"];
    try{
        await db.query("INSERT INTO books (title, author, cover_id) VALUES ($1, $2, $3)",
        [currentBook.title, currentBook.author, currentBook.cover_id]);
        // const posted_id = await db.query("SELECT id FROM books");
        // const len = posted_id.rows.length;
        // //console.log(posted_id.rows[len]);
        await db.query("INSERT INTO reviews (review_name, review_body, book_id) VALUES ($1, $2, $3)",
            [postTitle, postBody, bookID++]);
        // console.log(inserted_book);
        // console.log('id:', inserted_book.id); 
        //console.log(posted_books);
        //res.redirect("books.ejs", { reviewed_books: posted_books.rows});
        res.redirect("/books");
    } catch(err){
        console.log(err.message);
    }
});

app.get("/books", async (req, res) => {
    try{
        const posted_books = await db.query("SELECT * FROM reviews INNER JOIN books ON reviews.book_id = books.id");
        res.render("books.ejs", {
            reviewed_books: posted_books.rows,
        });
    }catch(err){
        console.log(err.message);
        // If there is an error pass through an error to be displayed
        res.render("books.ejs", {
            reviewed_books: {},
            error: err});
    }
    
});

app.post("/edit", (req, res) => {
    const editBook = JSON.parse(req.body.selected_book_edit); 

    res.render("review.ejs", {
        selectedBook: editBook, bookToEdit: editBook
    });
});

app.post("/post-edit", async (req, res) => {
    try{
        const current_book_id = req.body.hiddenID;
        const posted_books = await db.query("SELECT * FROM reviews INNER JOIN books ON reviews.book_id = books.id");
        console.log(current_book_id);
        
        const book_to_edit = posted_books.rows.find((book) => {
            return book.cover_id == current_book_id;
        });

        console.log(posted_books.rows);
        console.log(book_to_edit);

        await db.query("UPDATE reviews SET review_name = ($1), review_body = ($2) WHERE book_id = ($3)",
            [req.body.editReviewTitle, req.body.editReviewBody, book_to_edit.id]
        )

        res.redirect("/books");
    }catch(err){
        console.log(err.message);
    }
});

app.post("/delete", async (req, res) => {
    const book_to_delete = JSON.parse(req.body.selected_book_del);
    const books_table = await db.query("SELECT * FROM books");
    console.log(book_to_delete);

    try{
        await db.query("DELETE FROM reviews WHERE book_id=($1)",
            [book_to_delete.id]
        )
        await db.query("DELETE FROM books WHERE id=($1)",
            [book_to_delete.id]);
        res.redirect("/books");
    }catch(err){
        console.log(err.message);
    }
});

app.listen(port, () => {
    console.log(`Server is listening on Port: ${port}`);
})