import args from './Greeter.args'
import { compile } from './utils/compile'
import { tryCatch } from './utils/tryCatch'

tryCatch(compile('Greeter', ...args))
