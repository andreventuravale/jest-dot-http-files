import { CstParser, Lexer, createToken } from "chevrotain"

const Newline = createToken({ name: "Newline", pattern: /\r?\n/ })
const Space = createToken({ name: "Space", pattern: / +/ })
const Method = createToken({ name: "Method", pattern: /GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS/, longer_alt: Space })
const Url = createToken({ name: "Url", pattern: /https?:\/\/[^\s]+/ })
const HeaderKey = createToken({ name: "HeaderKey", pattern: /[^\s:]+/ })
const HeaderValue = createToken({ name: "HeaderValue", pattern: /[^\r\n]+/ })
const HeaderSeparator = createToken({ name: "HeaderSeparator", pattern: /:/ })
const TestSeparator = createToken({ name: "RequestBody", pattern: /###/ })

const allTokens = [Newline, Space, Method, Url, HeaderKey, HeaderValue, HeaderSeparator, RequestBody, TestSeparator]

const HttpLexer = new Lexer(allTokens)

class HttpParser extends CstParser {
  constructor() {
    super(allTokens)

    const $ = this

    $.RULE("httpFile", () => {
      $.MANY_SEP({
        SEP: Newline,
        DEF: () => {
          $.SUBRULE($.request)
        }
      })
    })

    $.RULE("request", () => {
      $.SUBRULE($.requestLine)
      $.MANY(() => {
        $.SUBRULE($.header)
      })
      $.OPTION(() => {
        $.CONSUME(Newline)
        $.CONSUME(RequestBody)
      })
    })

    $.RULE("requestLine", () => {
      $.CONSUME(Method)
      $.CONSUME(Space)
      $.CONSUME(Url)
      $.CONSUME(Newline)
    })

    $.RULE("header", () => {
      $.CONSUME(HeaderKey)
      $.CONSUME(HeaderSeparator)
      $.CONSUME(HeaderValue)
      $.CONSUME(Newline)
    })

    this.performSelfAnalysis()
  }
}

export default async (inputText) => {
  const parser = new HttpParser()

  const lexingResult = HttpLexer.tokenize(inputText)

  if (lexingResult.errors.length > 0) {
    throw new Error("Lexing errors detected")
  }

  parser.input = lexingResult.tokens

  const cst = parser.httpFile()

  if (parser.errors.length > 0) {
    throw new Error("Parsing errors detected")
  }

  console.log(cst)

  return cst
}