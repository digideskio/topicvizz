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
        println("Annotating...")
        val tempAText = annotate(tempText)
        if (tempAText.indexOf("<Resources>") > -1) {
          val tempACText = tempAText.substring(tempAText.indexOf("<Resources>"), tempAText.indexOf("</Resources>") + "</Resources>".length())
          // Tag text
          val tempTText = tag(tempACText)
          // Mapping Topic -> Files
          for (topic ← tempTText) {
            if (!oTopicMap.contains(topic.name.toUpperCase)) {
              val tempAbstract = getAbstract(topic.name, topic.value.toString)
              val tempTopic = new TopicVizz_Topic(topic.name, tempAbstract, topic.value)
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

  def linkTopics() {
    println("Linking...")
    for (topic ← oTopicMap) {
      val tempAText = annotate(topic._2.getSAbstract)
      if (tempAText.indexOf("<Resources>") > -1) {
        val tempACText = tempAText.substring(tempAText.indexOf("<Resources>"), tempAText.indexOf("</Resources>") + "</Resources>".length())
        val tempTText = tag(tempACText)
        for (topic2 ← tempTText) {
          if ((oTopicMap.contains(topic2.name.toUpperCase())) && (topic._2.getSTopic.toUpperCase() != topic2.name.toUpperCase())) {
            val neighbour: TopicVizz_Topic = oTopicMap.apply(topic2.name.toUpperCase())
            if (!topic._2.containsNeighbour(neighbour)) {
              topic._2.addNeighbour(neighbour, topic2.simScore)
            }
          }
        }
      }
    }
  }

  def createJSONFile(sPath: String) {
    val file = new File(sPath)
    val writer = new BufferedWriter(new OutputStreamWriter(
      new FileOutputStream(sPath), "UTF-8"));
    try {
      println("Start writing JSON... [" + file.getPath + "]")
      writer.write("{" + "\n" +
        "\"topics\" :" + "\n" +
        "[" + "\n")
      writer.flush()
      for (topic ← oTopicMap) {
        writer.write(createJSONTopicString(topic._2))
        writer.flush()
      }
      writer.write("\n" +
        "],\n" +
        "\"authors\" :" + "\n" +
        "[" + "\n")
      writer.flush()
      for (author ← oAuthorMap) {
        writer.write(createJSONAuthorString(author._2))
        writer.flush()
      }
      writer.write("\n]" +
        "\n}")
      writer.flush()
      println("Finished writing.")
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
        "\"topic\" :\"" + oTopic.getSTopic.replace("\"", "") + "\",\n" +
        "\"abstract\" :\"" + oTopic.getSAbstract.replace("\"", "").replace("\t", "") + "\",\n" +
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
        "\"edges\" : ["
      for (neighbour ← oTopic.neighbours) {
        json +=
          "{\"neighbour\":" + "\"" + neighbour._1.id + "\"," +
          "\"weight\":" + neighbour._2 + "}"
        if (oTopic.neighbours.last != neighbour) {
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
        val data = "text=" + urlEncoded + "&support=50&confidence=0.3"
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

  def getAbstract(sTopic: String, sURL: String): String = {
    var out: OutputStreamWriter = null
    var in: InputStream = null
    var Decoder: Scanner = null

    val query = "SELECT ?abstract FROM NAMED <http://dbpedia.org> WHERE " +
      "{{ <" + sURL + "> " +
      "<http://dbpedia.org/ontology/abstract> ?abstract. FILTER (LANG(?abstract)='de')}}"

    try {
      val urlEncoded = java.net.URLEncoder.encode(query, "UTF-8")
      val url = new java.net.URL("http://de.dbpedia.org/sparql?default-graph-uri=http%3A%2F%2Fde.dbpedia.org")
      val data = "query=" + urlEncoded
      val conn = url.openConnection()
      conn.setDoOutput(true)
      out = new java.io.OutputStreamWriter(conn.getOutputStream)
      out.write(data)
      out.flush()
      in = conn.getInputStream
      Decoder = new Scanner(in, "UTF-8")
      val decodedText = Decoder.useDelimiter("\\A").next()
      decodedText.substring(decodedText.indexOf("<td>") + "</td>".length(), decodedText.indexOf("</td>") - 4)
    } catch {
      case e: Exception ⇒ e.getMessage()

    } finally {
      out.close()
      Decoder.close()
      in.close()
    }
  }

  def tag(annotatedText: String): Set[Tag] = {
    import scala.xml.XML._
    val x = load(new StringReader(annotatedText))
    (for (resource ← x \ "Resource") yield Tag(resource \ "@surfaceForm" text, new URL(resource \ "@URI" text), (resource \ "@similarityScore" text).toDouble))toSet
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
