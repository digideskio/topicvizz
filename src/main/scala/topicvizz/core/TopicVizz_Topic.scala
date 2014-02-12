package topicvizz.core

import scala.beans.BeanProperty
import scala.collection.Iterable
import java.net.URL
import java.util.UUID

/**
  *
  * @param sTopic
  * @param sUrl
  */
class TopicVizz_Topic(@BeanProperty var sTopic: String, @BeanProperty var sUrl: URL) {

  val id: String = String.valueOf(UUID.randomUUID())
  private var oFileList: List[TopicVizz_File] = List()
  private var oAuthorList: List[TopicVizz_Author] = List()
  private var oYearMap: scala.collection.mutable.Map[String, Integer] = scala.collection.mutable.Map()

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

  /**
    *
    * @return
    */
  def authors: Iterable[TopicVizz_Author] = oAuthorList

  /**
    *
    * @param oTopicVizz_Author
    */
  def addAuthor(oTopicVizz_Author: TopicVizz_Author): Unit = {
    oAuthorList = oTopicVizz_Author :: oAuthorList
  }

  /**
    *
    * @param oTopicVizz_Author
    * @return
    */
  def containsAuthor(oTopicVizz_Author: TopicVizz_Author): Boolean = {
    oAuthorList.contains(oTopicVizz_Author)
  }

  /**
    *
    * @return
    */
  def yearsCount: scala.collection.mutable.Map[String, Integer] = oYearMap

  def addYearCount(sYear: String) {
    if (oYearMap.contains(sYear)) {
      oYearMap += sYear -> (oYearMap.get(sYear).get + 1)
    } else {
      oYearMap += sYear -> 1
    }
  }

}

