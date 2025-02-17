/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect", "FastCheck.assert", "ensureElementsHaveUID", "checkElementUIDs"] }] */
import * as FastCheck from 'fast-check'
import { assertNever } from '../../../core/shared/utils'
import { MajesticBrokerTestCaseCode } from '../../../test-cases/majestic-broker'
import {
  emptyComments,
  isJSXElement,
  isUtopiaJSXComponent,
  jsExpressionOtherJavaScript,
  jsxAttributesFromMap,
  jsExpressionValue,
  jsxElement,
  utopiaJSXComponent,
  isJSExpressionOtherJavaScript,
} from '../../shared/element-template'
import type { ProjectContents } from '../../shared/project-file-types'
import { directory } from '../../shared/project-file-types'
import {
  codeFile,
  foldParsedTextFile,
  isParseSuccess,
  RevisionsState,
  textFile,
  textFileContents,
  unparsed,
} from '../../shared/project-file-types'
import { lintAndParse, parseCode, printCode, printCodeOptions } from './parser-printer'
import type { ArbitraryProject } from './parser-printer.test-utils'
import {
  ensureArbitraryBlocksHaveUID,
  ensureElementsHaveUID,
  isWantedElement,
  printedProjectContentArbitrary,
  testParseCode,
} from './parser-printer.test-utils'
import { applyPrettier } from 'utopia-vscode-common'
import type { ProjectContentTreeRoot } from '../../../components/assets'
import { addFileToProjectContents, contentsToTree } from '../../../components/assets'
import {
  DefaultPackageJson,
  StoryboardFilePath,
} from '../../../components/editor/store/editor-state'
import { emptySet, setsEqual } from '../../shared/set-utils'
import { createCodeFile } from '../../../components/custom-code/code-file.test-utils'
import { renderTestEditorWithProjectContent } from '../../../components/canvas/ui-jsx.test-utils'
import { updateFile } from '../../../components/editor/actions/action-creators'
import { getUidMappings, getAllUniqueUidsFromMapping } from '../../model/get-uid-mappings'

function addCodeFileToProjectContents(
  projectContents: ProjectContentTreeRoot,
  path: string,
  contents: string,
  alreadyExistingUIDs_MUTABLE: Set<string>,
): ProjectContentTreeRoot {
  const parseResult = lintAndParse(
    path,
    [],
    contents,
    null,
    alreadyExistingUIDs_MUTABLE,
    'trim-bounds',
    'do-not-apply-steganography',
  )
  const file = textFile(
    textFileContents(contents, parseResult, RevisionsState.BothMatch),
    null,
    isParseSuccess(parseResult) ? parseResult : null,
    0,
  )
  return addFileToProjectContents(projectContents, path, file)
}

describe('parseCode', () => {
  it('produces unique IDs for every element', () => {
    const parseResult = testParseCode(MajesticBrokerTestCaseCode)
    foldParsedTextFile(
      (_) => {
        throw new Error('Is a failure.')
      },
      (success) => {
        const projectContents = addFileToProjectContents(
          {},
          StoryboardFilePath,
          textFile(
            textFileContents(MajesticBrokerTestCaseCode, success, RevisionsState.BothMatch),
            null,
            success,
            0,
          ),
        )
        const result = getUidMappings(projectContents)
        expect(getAllUniqueUidsFromMapping(result.filePathToUids)).toHaveLength(493)
        expect(result.duplicateIDs.size).toEqual(0)
      },
      (_) => {
        throw new Error('Is unparsed.')
      },
      parseResult,
    )
  })

  it('fixes duplicated UIDs for single file projects', () => {
    const alreadyExistingUIDs_MUTABLE: Set<string> = emptySet()
    let projectContents: ProjectContentTreeRoot = {}

    projectContents = addCodeFileToProjectContents(
      projectContents,
      '/src/app.js',
      `import * as React from 'react'
        import { Card } from './card'

        export const App = (props) => {
          return (
            <div data-uid='duplicated'>
              <div data-uid='duplicated'>Hello World!</div>
              <Card data-uid='aaa' />
            </div>
          )
        }
      `,
      alreadyExistingUIDs_MUTABLE,
    )

    const result = getUidMappings(projectContents)
    expect(getAllUniqueUidsFromMapping(result.filePathToUids)).toHaveLength(7)
    expect(result.duplicateIDs.size).toEqual(0)
  })

  it('fixes duplicated UIDs for multifile projects', () => {
    const alreadyExistingUIDs_MUTABLE: Set<string> = emptySet()
    let projectContents = {}

    projectContents = addCodeFileToProjectContents(
      projectContents,
      '/src/app.js',
      `import * as React from 'react'
        import { Card } from './card'

        export const App = (props) => {
          return (
            <div data-uid='duplicated'>
              <div data-uid='duplicated'>Hello World!</div>
              <Card data-uid='aaa' />
            </div>
          )
        }
        `,
      alreadyExistingUIDs_MUTABLE,
    )

    projectContents = addCodeFileToProjectContents(
      projectContents,
      '/src/card.js',
      `import * as React from 'react'

        export const Card = (props) => {
          return (
            <div data-uid='duplicated'>
              <div data-uid='duplicated2'>Hello World!</div>
              <div data-uid='aab'></div>
            </div>
          )
        } `,
      alreadyExistingUIDs_MUTABLE,
    )

    const result = getUidMappings(projectContents)
    expect(getAllUniqueUidsFromMapping(result.filePathToUids)).toHaveLength(14)
    expect(result.duplicateIDs.size).toEqual(0)
  })

  it('can successfully load a multifile project with duplicated UIDs', async () => {
    let projectContents: ProjectContents = {
      '/package.json': textFile(
        textFileContents(
          JSON.stringify(DefaultPackageJson, null, 2),
          unparsed,
          RevisionsState.CodeAhead,
        ),
        null,
        null,
        0,
      ),
      '/src': directory(),
      '/utopia': directory(),
      [StoryboardFilePath]: createCodeFile(
        StoryboardFilePath,
        `
  import * as React from 'react'
  import Utopia, {
    Scene,
    Storyboard,
  } from 'utopia-api'
  import { App } from '/src/app.js'

  export var storyboard = (
    <Storyboard data-uid='storyboard'>
      <Scene
        data-uid='scene'
        style={{ position: 'absolute', left: 0, top: 0, width: 375, height: 812 }}
      >
        <App data-uid='app' />
      </Scene>
    </Storyboard>
  )`,
      ),
      '/src/app.js': createCodeFile(
        '/src/app.js',
        `import * as React from 'react'
        import { Card } from './card'

        export const App = (props) => {
          return (
            <div data-uid='duplicated'>
              <div data-uid='duplicated'>Hello World!</div>
              <Card data-uid='aaa' />
            </div>
          )
        }
        `,
      ),
      '/src/card.js': createCodeFile(
        '/src/card.js',
        `import * as React from 'react'

        export const Card = (props) => {
          return (
            <div data-uid='duplicated'>
              <div data-uid='duplicated2'>Hello World!</div>
              <div data-uid='aab'></div>
            </div>
          )
        } `,
      ),
    }
    const renderResult = await renderTestEditorWithProjectContent(
      contentsToTree(projectContents),
      'dont-await-first-dom-report',
    )

    const result = getUidMappings(renderResult.getEditorState().editor.projectContents)
    expect(getAllUniqueUidsFromMapping(result.filePathToUids)).toHaveLength(26)
    expect(result.duplicateIDs.size).toEqual(0)
  })

  it('can successfully handle a multifile project with duplicated UIDs added later', async () => {
    let projectContents: ProjectContents = {
      '/package.json': textFile(
        textFileContents(
          JSON.stringify(DefaultPackageJson, null, 2),
          unparsed,
          RevisionsState.CodeAhead,
        ),
        null,
        null,
        0,
      ),
      '/src': directory(),
      '/utopia': directory(),
      [StoryboardFilePath]: createCodeFile(
        StoryboardFilePath,
        `
  import * as React from 'react'
  import Utopia, {
    Scene,
    Storyboard,
  } from 'utopia-api'
  import { App } from '/src/app.js'

  export var storyboard = (
    <Storyboard data-uid='storyboard'>
      <Scene
        data-uid='scene'
        style={{ position: 'absolute', left: 0, top: 0, width: 375, height: 812 }}
      >
        <App data-uid='duplicated1' />
      </Scene>
    </Storyboard>
  )`,
      ),
      '/src/app.js': createCodeFile(
        '/src/app.js',
        `import * as React from 'react'

        export const App = (props) => {
          return (
            <div data-uid='duplicated2'>
              <div data-uid='duplicated3'>Hello World!</div>
            </div>
          )
        }
        `,
      ),
    }
    const renderResult = await renderTestEditorWithProjectContent(
      contentsToTree(projectContents),
      'dont-await-first-dom-report',
    )

    const resultBefore = getUidMappings(renderResult.getEditorState().editor.projectContents)
    expect(getAllUniqueUidsFromMapping(resultBefore.filePathToUids)).toHaveLength(17)
    expect(resultBefore.duplicateIDs.size).toEqual(0)

    await renderResult.dispatch(
      [
        updateFile(
          '/src/card.js',
          codeFile(
            `
          import * as React from 'react'

          export const Card = (props) => {
            return (
              <div data-uid='duplicated1'>
                <div data-uid='duplicated2'>Hello World!</div>
                <div data-uid='duplicated3'>Hello World!</div>
              </div>
            )
          }
          `,
            null,
          ),
          true,
        ),
      ],
      false,
    )

    const resultAfter = getUidMappings(renderResult.getEditorState().editor.projectContents)
    expect(getAllUniqueUidsFromMapping(resultAfter.filePathToUids)).toHaveLength(25)
    expect(resultAfter.duplicateIDs.size).toEqual(0)
  })
})

describe('printCode', () => {
  it('applies changes back into the original code', () => {
    const startingCode = `
import * as react from 'react'
import { Scene, Storyboard, View, Group } from 'utopia-api'

export var app = (props) => {
  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {
        <div
          style={{
            backgroundColor: 'red',
            position: 'absolute',
            width: 86,
            height: 130,
            left: 45,
            top: 87,
          }}
        />
      }
    </div>
  )
}
    `
    const parsedCode = parseCode(
      'test.js',
      [],
      startingCode,
      null,
      emptySet(),
      'do-not-apply-steganography',
    )
    const actualResult = foldParsedTextFile(
      (_) => 'FAILURE',
      (success) => {
        const updatedTopLevelElements = success.topLevelElements.map((tle) => {
          if (isUtopiaJSXComponent(tle)) {
            const rootElement = tle.rootElement
            if (isJSXElement(rootElement)) {
              const firstChild = rootElement.children[0]
              if (isJSExpressionOtherJavaScript(firstChild)) {
                const firstKey = Object.keys(firstChild.elementsWithin)[0]
                const firstElementWithin = firstChild.elementsWithin[firstKey]
                if (isJSXElement(firstElementWithin)) {
                  const updatedAttributes = jsxAttributesFromMap({
                    style: jsExpressionValue(
                      {
                        backgroundColor: 'red',
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: 100,
                        height: 200,
                      },
                      emptyComments,
                    ),
                  })
                  const updatedElementsWithin = {
                    [firstKey]: jsxElement(
                      firstElementWithin.name,
                      firstKey,
                      updatedAttributes,
                      firstElementWithin.children,
                    ),
                  }
                  const updatedFirstChild = jsExpressionOtherJavaScript(
                    isJSExpressionOtherJavaScript(firstChild) ? firstChild.params : [],
                    firstChild.originalJavascript,
                    firstChild.javascriptWithUIDs,
                    firstChild.transpiledJavascript,
                    firstChild.definedElsewhere,
                    firstChild.sourceMap,
                    updatedElementsWithin,
                    firstChild.comments,
                  )
                  const updatedRootElement = jsxElement(
                    rootElement.name,
                    rootElement.uid,
                    rootElement.props,
                    [updatedFirstChild],
                  )
                  const updatedComponent = utopiaJSXComponent(
                    tle.name,
                    tle.isFunction,
                    tle.declarationSyntax,
                    tle.blockOrExpression,
                    tle.functionWrapping,
                    tle.params,
                    tle.propsUsed,
                    updatedRootElement,
                    tle.arbitraryJSBlock,
                    tle.usedInReactDOMRender,
                    tle.returnStatementComments,
                  )
                  return updatedComponent
                }
              }
            }
          }
          return tle
        })
        return printCode(
          '/index.js',
          printCodeOptions(false, true, false, true),
          success.imports,
          updatedTopLevelElements,
          success.jsxFactoryFunction,
          success.exportsDetail,
        )
      },
      (_) => 'UNPARSED',
      parsedCode,
    )
    const expectedResult = applyPrettier(
      `
import * as react from 'react'
import { Scene, Storyboard, View, Group } from 'utopia-api'

export var app = (props) => {
  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {
        <div
          style={{
            backgroundColor: 'red',
            position: 'absolute',
            left: 0,
            top: 0,
            width: 100,
            height: 200,
          }}
        />
      }
    </div>
  )
}
    `,
      false,
    ).formatted
    expect(actualResult).toEqual(expectedResult)
  })
})

describe('check that the UIDs of everything in a file also align with the highlight bounds for that file', () => {
  function checkElementUIDs(stripUIDs: boolean): void {
    function checkElementUIDSMatchHighlightBounds(
      printedArbitraryProjects: [ArbitraryProject, ArbitraryProject],
    ): boolean {
      const [firstPrintedProjectContent, secondPrintedProjectContent] = printedArbitraryProjects
      const alreadyExistingUIDs: Set<string> = emptySet()

      let fileCounter: number = 100
      let projectContents: ProjectContents = {}

      for (const { code: printedCode } of [
        firstPrintedProjectContent,
        secondPrintedProjectContent,
      ]) {
        const parseResult = testParseCode(printedCode, alreadyExistingUIDs)
        foldParsedTextFile(
          (failure) => {
            throw new Error(`${JSON.stringify(failure)}`)
          },
          (success) => {
            let uids: Array<string> = []
            for (const topLevelElement of success.topLevelElements) {
              switch (topLevelElement.type) {
                case 'UTOPIA_JSX_COMPONENT':
                  ensureElementsHaveUID(
                    topLevelElement.rootElement,
                    uids,
                    isWantedElement,
                    'walk-attributes',
                  )
                  if (topLevelElement.arbitraryJSBlock != null) {
                    ensureArbitraryBlocksHaveUID(
                      topLevelElement.arbitraryJSBlock,
                      uids,
                      isWantedElement,
                      'walk-attributes',
                    )
                  }
                  break
                case 'ARBITRARY_JS_BLOCK':
                  ensureArbitraryBlocksHaveUID(
                    topLevelElement,
                    uids,
                    isWantedElement,
                    'walk-attributes',
                  )
                  break
                case 'IMPORT_STATEMENT':
                case 'UNPARSED_CODE':
                  break
                default:
                  assertNever(topLevelElement)
              }
            }

            // Check the UIDs for the elements, which excludes attributes.
            const elementUIDS = new Set(uids)
            const highlightBoundsUIDs = new Set(Object.keys(success.highlightBounds))
            if (!setsEqual(elementUIDS, highlightBoundsUIDs)) {
              throw new Error(
                `Element UIDs [${Array.from(
                  elementUIDS,
                ).sort()}] do not match the highlight bounds UIDs: [${Array.from(
                  highlightBoundsUIDs,
                ).sort()}]`,
              )
            }

            const fileValue = textFile(
              textFileContents(printedCode, success, RevisionsState.ParsedAhead),
              null,
              null,
              0,
            )
            const singleFileUniqueIDsResult = getUidMappings(
              contentsToTree({ '/index.js': fileValue }),
            )

            // Check the UIDs for anything and everything, including attributes.
            const fullHighlightBoundsUIDs = new Set(Object.keys(success.fullHighlightBounds))
            const allUIDsAreEqual = setsEqual(
              fullHighlightBoundsUIDs,
              new Set(getAllUniqueUidsFromMapping(singleFileUniqueIDsResult.filePathToUids)),
            )
            if (!allUIDsAreEqual) {
              throw new Error(
                `All UIDs [${Array.from(
                  getAllUniqueUidsFromMapping(singleFileUniqueIDsResult.filePathToUids),
                ).sort()}] do not match the full highlight bounds UIDs: [${Array.from(
                  fullHighlightBoundsUIDs,
                ).sort()}]`,
              )
            }

            projectContents[`/index${fileCounter++}.js`] = fileValue
          },
          (unparsedResult) => {
            throw new Error(`${unparsedResult}`)
          },
          parseResult,
        )
      }

      // Check that this parse has not surfaced any duplicates within itself.
      const uniqueIDsResult = getUidMappings(contentsToTree(projectContents))
      const anyDuplicates = Object.keys(uniqueIDsResult.duplicateIDs).length > 0
      if (anyDuplicates) {
        throw new Error(`Found duplicate UIDs: ${uniqueIDsResult.duplicateIDs}`)
      }

      return true
    }
    const printedArbitrary = printedProjectContentArbitrary(stripUIDs)
    const dataUIDProperty = FastCheck.property(
      FastCheck.tuple(printedArbitrary, printedArbitrary),
      checkElementUIDSMatchHighlightBounds,
    )
    FastCheck.assert(dataUIDProperty, { verbose: false, numRuns: 20 })
  }
  it.concurrent('with UIDs left in', () => {
    checkElementUIDs(false)
  })
  it.concurrent('with UIDs stripped', () => {
    checkElementUIDs(true)
  })
})
