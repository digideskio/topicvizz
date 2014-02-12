import java.io.File
import java.util.Scanner
import java.util.regex.Pattern

import topicvizz.common._

import org.apache.lucene.analysis.standard._
import org.apache.lucene.document._
import org.apache.lucene.index._
import org.apache.lucene.queryparser.classic._
import org.apache.lucene.store._
import org.apache.lucene.util._
import org.apache.lucene.search._
import org.apache.pdfbox.pdmodel._
import org.apache.pdfbox.util._

/**
  * For testing purpose only
  */
object TopicVizz_LuceneDemo {

  def main(args: Array[String]) {
    // Construct a RAMDirectory to hold the in-memory representation
    // of the index.
    val idx = new RAMDirectory()
    val analyzer = new StandardAnalyzer(Version.LUCENE_45)
    val config = new IndexWriterConfig(Version.LUCENE_45, analyzer)
    //try {
    // Make an writer to create the index
    val writer =
      new IndexWriter(idx, config)

    // Read working directory
    val userDir = new File(System.getProperty("user.dir"))
    // Read pdf directory
    val pdfDir = new File(userDir + "\\src\\main\\resources\\pdfs\\")
    System.out.println("Directory: " + pdfDir)
    // Iterate over pdf files, printing:
    // # name
    // # additional informations
    // # text
    // Adds them to the Index

    val filter = new PDFFilenameFilter()
    for (inputFile ← pdfDir.listFiles(filter)) {
      //  System.out.println("\n######################\n")
      //  System.out.println("Count: " + ++count)
      //  System.out.println("File: " + inputFile)
      val pdDocument = PDDocument.load(inputFile)
      //  System.out.println("Number of Pages: "
      //         + pdDocument.getNumberOfPages())
      val bEncrypted = pdDocument.isEncrypted()
      //  System.out.println("Encrypted: " + bEncrypted)
      if (!bEncrypted) {
        val tempStripper = new PDFTextStripper()
        val tempText = tempStripper.getText(pdDocument)
        val annotateText = annotate(tempText)
        //addDoc(inputFile.toString(), tempText)
        writer.addDocument(createDocument(inputFile.getName(), annotateText))

        val pattern = Pattern.compile("<a href=")
        val matcher = pattern.matcher(annotateText)
        var maxFiles = false;
        while (matcher.find() && !maxFiles) {
          System.out.println(matcher.group())
        }
        if (writer.numDocs() == 5) {
          maxFiles = true
        }
        System.out.println(inputFile.getName())
      }
    }

    // Add some Document objects containing quotes
    //            writer.addDocument(createDocument("Theodore Roosevelt",
    //                    "It behooves every man to remember that the work of the " +
    //                            "critic, is of altogether secondary importance, and that, " +
    //                            "in the end, progress is accomplished by the man who does " +
    //                            "things."))
    //            writer.addDocument(createDocument("Friedrich Hayek",
    //                    "The case for individual freedom rests largely on the " +
    //                            "recognition of the inevitable and universal ignorance " +
    //                            "of all of us concerning a great many of the factors on " +
    //                            "which the achievements of our ends and welfare depend."))
    //            writer.addDocument(createDocument("Ayn Rand",
    //                    "There is nothing to take a man's freedom away from " +
    //                            "him, save other men. To be free, a man must be free " +
    //                            "of his brothers."))
    //            writer.addDocument(createDocument("Mohandas Gandhi",
    //                    "Freedom is not worth having if it does not connote " +
    //                            "freedom to err."))

    // Optimize and close the writer to finish building the index

    writer.close()

    // Build an IndexSearcher using the in-memory index
    val reader = DirectoryReader.open(idx)
    val searcher = new IndexSearcher(reader)

    // Run some queries
    search(searcher, "Chipkarte")
    //            search(searcher, "free or free")
    //            search(searcher, "progress or achievements")
    reader.close()

    //        }
    //        catch (IOException ioe) {
    //            // In this example we aren't really doing an I/O, so this
    //            // exception should never actually be thrown.
    //            ioe.printStackTrace()
    //        }
    //        catch (ParseException pe) {
    //            pe.printStackTrace()
    //        }
  }

  def annotate(plainText: String): String = {
    //        try {
    val urlEncoded = java.net.URLEncoder.encode(plainText, "UTF-8")
    val url = new java.net.URL(
      "http://spotlight.dbpedia.org/rest/annotate")
    val data = "text=" + urlEncoded + "&support=10&confidence=0.2"
    val conn = url.openConnection()
    conn.setDoOutput(true)
    val out = new java.io.OutputStreamWriter(
      conn.getOutputStream())
    out.write(data)
    out.flush()
    out.close()
    val in = conn.getInputStream()
    val Decoder = new Scanner(in, "UTF-8")
    val decodedText = Decoder.useDelimiter("\\A").next()
    System.out.println(decodedText)
    Decoder.close()
    in.close()
    return decodedText
    //        } catch (Exception e) {
    //            System.out.println(e.getMessage())
    //            return ""
    //        }

  }

  /**
    * Make a Document object with an un-indexed title field and an
    * indexed content field.
    */
  def createDocument(title: String, content: String): Document = {
    val doc = new Document()

    // Add the title as an unindexed field...

    doc.add(new Field("title", title, Field.Store.YES, Field.Index.NO))

    // ...and the content as an indexed field. Note that indexed
    // Text fields are constructed using a Reader. Lucene can read
    // and index very large chunks of text, without storing the
    // entire content verbatim in the index. In this example we
    // can just wrap the content string in a StringReader.
    doc.add(new Field("content", content, Field.Store.YES, Field.Index.ANALYZED))

    return doc
  }

  /**
    * Searches for the given string in the "content" field
    */
  def search(searcher: IndexSearcher, queryString: String) {

    // Build a Query object
    val parser = new QueryParser(Version.LUCENE_45,
      "content",
      new StandardAnalyzer(Version.LUCENE_45))
    val query = parser.parse(queryString)

    val hitsPerPage = 10
    // Search for the query
    val collector = TopScoreDocCollector.create(5 * hitsPerPage, false)
    searcher.search(query, collector)

    val hits = collector.topDocs().scoreDocs

    val hitCount = collector.getTotalHits()
    System.out.println(hitCount + " total matching documents")

    // Examine the Hits object to see if there were any matches

    if (hitCount == 0) {
      System.out.println(
        "No matches were found for \"" + queryString + "\"")
    } else {
      System.out.println("Hits for \"" +
        queryString + "\" were found in quotes by:")

      // Iterate over the Documents in the Hits object
      for (i ← 0 to hitCount) {
        val scoreDoc = hits(i)
        val docId = scoreDoc.doc
        val docScore = scoreDoc.score
        System.out.println("docId: " + docId + "\t" + "docScore: " + docScore)

        val doc = searcher.doc(docId)

        // Print the value that we stored in the "title" field. Note
        // that this Field was not indexed, but (unlike the
        // "contents" field) was stored verbatim and can be
        // retrieved.
        System.out.println("  " + (i + 1) + ". " + doc.get("title"))
        //System.out.println("Content: " + doc.get("content"))
      }
    }
    System.out.println()
  }
}