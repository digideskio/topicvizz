package topicvizz.core

import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.util.PDFTextStripper

import java.net.URL
import java.io._
import java.util.Scanner
import java.util.regex.Pattern
import java.text.SimpleDateFormat

import topicvizz.common.PDFFilenameFilter
import topicvizz.common.tagging.Tag
import topicvizz.common.tagging.Tag

/**
  *
  */
class TopicVizz_Parser {

  private var oFileList: List[TopicVizz_File] = List()
  private var oTopicMap: Map[String, TopicVizz_Topic] = Map()
  private var oAuthorMap: Map[String, TopicVizz_Author] = Map()

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
      val tempAuthorName = matchString("vortrag_vd-ak.*\\d\\d\\d\\d-\\d\\d-\\d\\d_(.*).pdf", pdfFile.getName, "Unknown", 1)
      var tempAuthor: TopicVizz_Author = null
      if (!oAuthorMap.contains(tempAuthorName)) {
        tempAuthor = new TopicVizz_Author(tempAuthorName)
        oAuthorMap += tempAuthorName.toUpperCase -> tempAuthor
      } else {
        tempAuthor = oAuthorMap.get(tempAuthorName).get
      }
      // Load pdf document
      val pdDocument = PDDocument.load(pdfFile)
      val bEncrypted = pdDocument.isEncrypted
      if (!bEncrypted) {
        // Parse text
        val tempStripper = new PDFTextStripper()
        val tempText = tempStripper.getText(pdDocument)
        val tempFile = new TopicVizz_File(pdfFile.getName(), tempType, tempText, tempAuthor, tempDate)
        tempAuthor.addFile(tempFile)
        oFileList = oFileList.+:(tempFile)
        // Annotate text
        val tempAText = annotate(tempText)
        if (tempAText.indexOf("<Resources>") > -1) {
          val tempACText = tempAText.substring(tempAText.indexOf("<Resources>"), tempAText.indexOf("</Resources>") + "</Resources>".length())
          // Tag text
          val tempTText = tag(tempACText)
          // Mapping Topic -> Files
          for (topic ← tempTText) {
            if (!oTopicMap.contains(topic.name.toUpperCase)) {
              val tempTopic = new TopicVizz_Topic(topic.name, topic.value)
              tempAuthor.addTopic(tempTopic)
              tempTopic.addAuthor(tempAuthor)
              tempTopic.addFile(tempFile)
              tempTopic.addYearCount(tempDate.substring(0, 4))
              oTopicMap += topic.name.toUpperCase -> tempTopic
            } else {
              val tempTopic = oTopicMap.get(topic.name.toUpperCase).get
              if (!tempTopic.containsFile(tempFile)) {
                tempTopic.addFile(tempFile)
              }
              if (!tempTopic.containsAuthor(tempAuthor)) {
                tempTopic.addAuthor(tempAuthor)
              }
              if (!tempAuthor.containsTopic(tempTopic)) {
                tempAuthor.addTopic(tempTopic)
              }
              tempTopic.addYearCount(tempDate.substring(0, 4))
            }
          }
        }
      }
    } catch {
      case e: Exception ⇒ e.printStackTrace()
    }
  }

  def createJSONFile(sPath: String) {
    val file = new File(sPath)
    val writer = new FileWriter(file, true)
    try {
      writer.write("{" + "\n" +
        "\"topics\" :" + "\n" +
        "[" + "\n")
      writer.flush()
      for (topic ← oTopicMap) {
        writer.write(createJSONTopicString(topic._2))
        writer.flush()
        println("T")
      }
      writer.write("\n" +
        "],\n" +
        "\"authors\" :" + "\n" +
        "[" + "\n")
      writer.flush()
      for (author ← oAuthorMap) {
        writer.write(createJSONAuthorString(author._2))
        writer.flush()
        println("A")
      }
      writer.write("\n]" +
        "\n}")
      writer.flush()
    } finally {
      writer.close()
    }
  }

  def createJSONTopicString(oTopic: TopicVizz_Topic): String =
    {
      var json: String = ""
      json +=
        "{" + "\n" +
        "\"id\" :\"" + oTopic.id + "\",\n" +
        "\"topic\" :\"" + oTopic.getSTopic + "\",\n" +
        "\"abstract\" :\"" + "NO ABSTRACT" + "\",\n" +
        "\"files\" : ["
      for (file ← oTopic.files) {
        json +=
          "\"" + file.getSFileName + "\""
        if (oTopic.files.last != file) {
          json += ","
        }
      }
      json +=
        "]," + "\n" +
        "\"mentioned_by\" : ["
      for (author ← oTopic.authors) {
        json +=
          "\"" + author.id + "\""
        if (oTopic.authors.last != author) {
          json += ","
        }
      }
      json +=
        "]," + "\n" +
        "\"frequency_per_year\" : {"
      for (year ← oTopic.yearsCount) {
        json +=
          "\"" + year._1 + "\":" + year._2
        if (oTopic.yearsCount.last != year) {
          json += ","
        }
      }
      json +=
        "}" + "\n" +
        "}"
      if (oTopicMap.last._2 != oTopic) {
        json += ",\n"
      }
      json
    }

  def createJSONAuthorString(oAuthor: TopicVizz_Author): String =
    {
      var json: String = ""
      json +=
        "{" + "\n" +
        "\"id\" :\"" + oAuthor.id + "\",\n" +
        "\"name\" :\"" + oAuthor.getSName + "\",\n" +
        "\"files\" : ["
      for (file ← oAuthor.files) {
        json +=
          "\"" + file.getSFileName + "\""
        if (oAuthor.files.last != file) {
          json += ","
        }
      }
      json +=
        "]," + "\n" +
        "\"mentioned\" : ["
      for (topic ← oAuthor.topics) {
        json +=
          "\"" + topic.id + "\""
        if (oAuthor.topics.last != topic) {
          json += ","
        }
      }
      json +=
        "]\n" +
        "}"
      if (oAuthorMap.last._2 != oAuthor) {
        json += ","
      }
      json
    }

  /**
    *
    * @param sPath
    */
  def parseDirectory(sPath: String) {
    try {
      val pdfDir = new File(sPath)
      val filter = new PDFFilenameFilter()
      var count = 0
      for (inputFile ← pdfDir.listFiles(filter)) {
        count = count + 1
        parseFile(inputFile.getPath)
        println(count + "\\" + pdfDir.listFiles(filter).length + " [" + inputFile.getName + "]")
      }
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
    var out: OutputStreamWriter = null
    var in: InputStream = null
    var Decoder: Scanner = null
    try {
      try {
        val urlEncoded = java.net.URLEncoder.encode(plainText, "UTF-8")
        val url = new java.net.URL("http://de.dbpedia.org/spotlight/rest/annotate")
        //val url = new java.net.URL("http://spotlight.dbpedia.org/rest/annotate")
        val data = "text=" + urlEncoded + "&support=10&confidence=0.3"
        val conn = url.openConnection()
        conn.setRequestProperty("Accept", "text/xml")
        conn.setDoOutput(true)
        out = new java.io.OutputStreamWriter(conn.getOutputStream)
        out.write(data)
        out.flush()
        in = conn.getInputStream
        Decoder = new Scanner(in, "UTF-8")
        var decodedText = ""
        if (Decoder.hasNext) {
          decodedText = Decoder.useDelimiter("\\A").next()
        }
        decodedText
      } finally {
        out.close()
        Decoder.close()
        in.close()
      }
    } catch {
      case e: NullPointerException ⇒ "Annotation failed."
    }
  }

  def tag(annotatedText: String): Set[Tag] = {
    import scala.xml.XML._
    val x = load(new StringReader(annotatedText))
    (for (resource ← x \ "Resource") yield Tag(resource \ "@surfaceForm" text, new URL(resource \ "@URI" text))).toSet
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
