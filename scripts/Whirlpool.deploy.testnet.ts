import args from './Whirlpool.args.testnet'
import { compile } from './utils/compile'
import { tryCatch } from './utils/tryCatch'

tryCatch(compile('Whirlpool', ...args))
