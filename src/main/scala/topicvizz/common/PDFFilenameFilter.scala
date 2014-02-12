package topicvizz.common

import java.io._

/**
  *
  */
class PDFFilenameFilter extends FilenameFilter {

  /**
    *
    * @param f
    * @param s
    * @return
    */
  override def accept(f: File, s: String): Boolean = {
    new File(f, s).isFile && s.toLowerCase().endsWith(".pdf")
  }
}
