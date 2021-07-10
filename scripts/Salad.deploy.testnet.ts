import args from './Salad.args.testnet'
import { compile } from './utils/compile'
import { tryCatch } from './utils/tryCatch'

tryCatch(compile('Salad', ...args))
