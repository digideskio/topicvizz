package topicvizz.core

import scala.beans.BeanProperty

/**
  *
  * @param sFileName
  * @param sPresentationType
  * @param sText
  * @param oAuthor
  * @param sDate
  */
class TopicVizz_File(@BeanProperty var sFileName: String,
                     @BeanProperty var sPresentationType: String,
                     @BeanProperty var sText: String,
                     @BeanProperty var oAuthor: TopicVizz_Author,
                     @BeanProperty var sDate: String)

