package topicvizz.core

import scala.beans.BeanProperty
import scala.collection.Iterable

/**
 *
 * @param sTopic
 * @param sUrl
 * @param sUrlTitle
 */
class TopicVizz_Topic(@BeanProperty var sTopic: String, @BeanProperty var sUrl: String, @BeanProperty var sUrlTitle: String) {

  private var oFileList: List[TopicVizz_File] = List()

  /**
   *
   * @return
   */
  def files: Iterable[TopicVizz_File] = oFileList

  /**
   *
   * @param oTopicVizz_File
   */
  def addFile(oTopicVizz_File: TopicVizz_File): Unit = {
    oFileList = oTopicVizz_File :: oFileList
  }

  /**
   *
   * @param oTopicVizz_File
   * @return
   */
  def containsFile(oTopicVizz_File: TopicVizz_File): Boolean = {
    oFileList.contains(oTopicVizz_File)
  }

}
   
