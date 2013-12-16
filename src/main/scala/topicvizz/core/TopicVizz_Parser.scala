package topicvizz.core

import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.util.PDFTextStripper

import java.io.File
import java.util.Scanner
import java.util.regex.Pattern

import topicvizz.common.PDFFilenameFilter

/**
 *
 */
class TopicVizz_Parser {

  private var oFileList: List[TopicVizz_File] = List()
  private var oTopicMap: Map[String, TopicVizz_Topic] = Map()

  /**
   *
   * @param sPath
   */
  def parseFile(sPath: String) {
    try {
      // Load document
      val pdfFile = new File(sPath)
      // Parse meta-information
      val tempType = matchString("(vortrag|beitrag)_.*.pdf", pdfFile.getName, "Undefined", 1)
      val tempDate = matchString("\\d\\d\\d\\d-\\d\\d-\\d\\d", pdfFile.getName, "YYYY-MM-DD", 0)
      val tempAuthor = matchString("vortrag_vd-ak.*\\d\\d\\d\\d-\\d\\d-\\d\\d_(.*).pdf", pdfFile.getName, "", 1)
      // Load pdf document
      val pdDocument = PDDocument.load(pdfFile)
      val bEncrypted = pdDocument.isEncrypted
      if (!bEncrypted) {
        // Parse text
        val tempStripper = new PDFTextStripper()
        val tempText = tempStripper.getText(pdDocument)
        val tempFile = new TopicVizz_File(sPath, tempType, tempText, tempAuthor, tempDate)
        oFileList = oFileList.+:(tempFile)
        // Annotate text
        val tempAText = annotate(tempText)
        // Parse topics out of href-tag
        val hrefPattern = Pattern.compile("<a href=\"(.*)\" title=\"(.*)\" target=(.*)>(.*)</a>")
        val hrefMatcher = hrefPattern.matcher(tempAText)
        while (hrefMatcher.find()) {
          val tempTopicName = hrefMatcher.group(4)
          if (!oTopicMap.contains(tempTopicName.toUpperCase)) {
            val tempTopic = new TopicVizz_Topic(tempTopicName, hrefMatcher.group(2), hrefMatcher.group(1))
            oTopicMap += tempTopicName.toUpperCase -> tempTopic
            if (!tempTopic.containsFile(tempFile)) {
              tempTopic.addFile(tempFile)
            }
          } else {
            val tempTopic = oTopicMap.get(tempTopicName.toUpperCase).get
            if (!tempTopic.containsFile(tempFile)) {
              tempTopic.addFile(tempFile)
            }
          }
        }
      }
      //      // Debug files
      //      for (tempDebug ← oFileList) {
      //        println("\n######################\n")
      //        println("Filename : " + tempDebug.getSFileName)
      //        println("PresentationType : " + tempDebug.getSPresentationType)
      //        println("Date : " + tempDebug.getSDate)
      //        println("Author : " + tempDebug.getSAuthor)
      //        println("Chars:" + tempDebug.getSText.length)
      //      }
    } catch {
      case e: Exception ⇒ println(e.getMessage)
    }
  }

  /**
   *
   * @param sPath
   */
  def parseDirectory(sPath: String) {
    try {
      val pdfDir = new File(sPath)
      val filter = new PDFFilenameFilter()
      for (inputFile ← pdfDir.listFiles(filter)) {
        parseFile(inputFile.getPath)
      }

      // Debug topics
      // For testing only
      //      println("\n######################\n")
      //      println("\n######################\n")
      //      println("\n######################\n")
      //      for (tempDebug <- oTopicMap.values)
      //      {
      //        println(tempDebug.getSTopic + " ||| " + tempDebug.files.size)
      //      }

    } catch {
      case e: Exception ⇒ println(e.getMessage)
    }
  }

  /**
   *
   * @param plainText
   * @return
   */
  private def annotate(plainText: String): String = {
    try {
      val urlEncoded = java.net.URLEncoder.encode(plainText, "UTF-8")
      val url = new java.net.URL("http://spotlight.dbpedia.org/rest/annotate")
      val data = "text=" + urlEncoded + "&support=10&confidence=0.3"
      val conn = url.openConnection()
      conn.setDoOutput(true)
      val out = new java.io.OutputStreamWriter(conn.getOutputStream)
      out.write(data)
      out.flush()
      out.close()
      val in = conn.getInputStream
      val Decoder = new Scanner(in, "UTF-8")
      val decodedText = Decoder.useDelimiter("\\A").next()
      Decoder.close()
      in.close()
      decodedText
    } catch {
      case e: Exception ⇒ {
        println(e.getMessage)
        ""
      }
    }
  }

  def matchString(sPattern: String, sString: String, sDefaultResult: String, iGroup: Integer): String = {
    try {
      val oPattern = Pattern.compile(sPattern)
      val oMatcher = oPattern.matcher(sString)
      if (oMatcher.find()) {
        oMatcher.group(iGroup)
      } else {
        sDefaultResult
      }
    } catch {
      case e: Exception ⇒
        println(e.getMessage)
        sDefaultResult
    }
  }

}
