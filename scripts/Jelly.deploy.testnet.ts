import args from './Jelly.args.testnet'
import { compile } from './utils/compile'
import { tryCatch } from './utils/tryCatch'

tryCatch(compile('Jelly', ...args))
