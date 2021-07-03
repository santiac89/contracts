import args from './CoolCoin.args'
import { compile } from './utils/compile'
import { tryCatch } from './utils/tryCatch'

tryCatch(compile('CoolCoin', ...args))
