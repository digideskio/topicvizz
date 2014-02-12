package topicvizz.core

import java.io.{ InputStream, OutputStreamWriter, BufferedReader, InputStreamReader }
import java.net.URL
import java.util.Scanner
import topicvizz.common.tagging.Tag
import org.apache.jena.atlas.json.io.JsonWriter

class TopicVizz_TopicAbstract {

  def getAbstract(sTopic: String): String = {
    var out: OutputStreamWriter = null
    var in: InputStream = null
    var Decoder: Scanner = null

    val query = "SELECT ?abstract FROM NAMED <http://dbpedia.org> WHERE " +
      "{{ <http://dbpedia.org/resource/Civil_engineering> " +
      "<http://dbpedia.org/ontology/abstract> ?abstract. FILTER (LANG(?abstract)='de')}}"

    try {
      val urlEncoded = java.net.URLEncoder.encode(query, "UTF-8")
      val url = new java.net.URL("http://dbpedia.org/sparql?default-graph-uri=http%3A%2F%2Fdbpedia.org")
      val data = "query=" + urlEncoded
      val conn = url.openConnection()
      conn.setDoOutput(true)
      out = new java.io.OutputStreamWriter(conn.getOutputStream)
      out.write(data)
      out.flush()
      in = conn.getInputStream
      Decoder = new Scanner(in, "UTF-8")
      val decodedText = Decoder.useDelimiter("\\A").next()
      println(decodedText)
      decodedText
    } catch {
      case e: Exception ⇒ e.getMessage()

    } finally {
      out.close()
      Decoder.close()
      in.close()
    }
  }

}
