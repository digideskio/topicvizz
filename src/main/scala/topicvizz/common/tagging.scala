package topicvizz.common

import java.net.URL
object tagging {
  case class Tag(name: String, value: URL, simScore: Double)
}
