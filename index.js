const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const url = require('url')

const request = require('request')
const cheerio = require('cheerio')

const loadStack = []
const loaded = []

var loading = 0

const entryPoint = 'https://zengweigang.gitbooks.io/core-go/index.html'

writeHTML(entryPoint, 10)

function writeHTML (srcUrl, maxConnect) {
  if (loading > maxConnect) return console.log('loadStack stack: ', '连接数达到上限')

  console.log('is loading: ', srcUrl)

  loading++

  request(srcUrl, (err, res, body) => {
    if (err) return console.log('request: ', err)

    const filePath = getFilePath(srcUrl)
    const mhtml = createMht(body, srcUrl)

    fs.writeFile(filePath, mhtml, (err) => {
      if (err) return console.log('write: ', err)

      loadStack.splice(loadStack.indexOf(srcUrl), 1)
      loaded.push(srcUrl)
      loading--

      console.log('is loaded: ', srcUrl)

      if (loadStack.length > 0) {
        writeHTML(loadStack[0], maxConnect)
        console.log('not loaded: ', loadStack.length)
      } else {
        console.log('total loaded: ', loaded.length)
      }
    })
  })
}

function getFilePath (srcUrl) {
  const hash = crypto.createHash('sha256').update(srcUrl).digest('hex').substring(0, 16)
  const filePath = path.resolve('/tmp/doff', hash)

  return filePath
}

function createMht (body, srcUrl) {
  const hrefs = getUriList(body, srcUrl)

  let newBody = body

  hrefs.forEach(({src, dist, md5}) => {
    newBody = newBody.replace(src, md5)
    if (loaded.includes(dist)) {
      console.log('already loaded: ', dist)
    } else if (loadStack.includes(dist)) {
      console.log('already stacked: ', dist)
    } else {
      loadStack.push(dist)
    }
  })

  return newBody
}

function getUriList (body, srcUrl) {
  const srcTypes = ['link:href', 'script:src', 'img:src', 'a:href']
  const $ = cheerio.load(body)
  const uris = []

  srcTypes.forEach(item => {
    const [selector, attrname] = item.split(':')
    const elems = $(selector)

    Object.keys(elems).forEach(key => {
      const elem = elems[key]
      const attrvalue = elem.attribs && elem.attribs[attrname]

      if (attrvalue && attrvalue.indexOf('http') < 0) {
        const urlObj = url.parse(srcUrl)
        const urlPath = urlObj.pathname
        const urlHost = urlObj.host
        const urlProtocol = urlObj.protocol
        const distUrl = `${urlProtocol}//${urlHost}${path.resolve(urlPath, '..', attrvalue)}`

        uris.push({
          src: attrvalue,
          dist: distUrl,
          md5: getFilePath(distUrl),
        })
      }
    })
  })

  return uris
}