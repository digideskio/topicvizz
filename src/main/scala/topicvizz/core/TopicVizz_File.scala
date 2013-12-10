package topicvizz.core

import scala.beans.BeanProperty

/**
 *
 * @param sFileName
 * @param sPresentationType
 * @param sText
 * @param sAuthor
 * @param sDate
 */
class TopicVizz_File(@BeanProperty var sFileName: String,
                     @BeanProperty var sPresentationType: String,
                     @BeanProperty var sText: String,
                     @BeanProperty var sAuthor: String,
                     @BeanProperty var sDate: String)

