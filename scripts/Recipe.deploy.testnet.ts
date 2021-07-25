import args from './Recipe.args.testnet'
import { compile } from './utils/compile'
import { tryCatch } from './utils/tryCatch'

tryCatch(compile('Recipe', ...args))
