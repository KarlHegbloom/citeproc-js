/*
 * Copyright (c) 2009-2013 Frank G. Bennett, Jr. All Rights
 * Reserved.
 *
 * The contents of this file are subject to the Common Public
 * Attribution License Version 1.0 (the “License”); you may not use
 * this file except in compliance with the License. You may obtain a
 * copy of the License at:
 *
 * http://bitbucket.org/fbennett/citeproc-js/src/tip/LICENSE.
 *
 * The License is based on the Mozilla Public License Version 1.1 but
 * Sections 1.13, 14 and 15 have been added to cover use of software over a
 * computer network and provide for limited attribution for the
 * Original Developer. In addition, Exhibit A has been modified to be
 * consistent with Exhibit B.
 *
 * Software distributed under the License is distributed on an “AS IS”
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See
 * the License for the specific language governing rights and limitations
 * under the License.
 *
 * The Original Code is the citation formatting software known as
 * "citeproc-js" (an implementation of the Citation Style Language
 * [CSL]), including the original test fixtures and software located
 * under the ./tests subdirectory of the distribution archive.
 *
 * The Original Developer is not the Initial Developer and is
 * __________. If left blank, the Original Developer is the Initial
 * Developer.
 *
 * The Initial Developer of the Original Code is Frank G. Bennett,
 * Jr. All portions of the code written by Frank G. Bennett, Jr. are
 * Copyright (c) 2009-2013 Frank G. Bennett, Jr. All Rights Reserved.
 *
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU Affero General Public License (the [AGPLv3]
 * License), in which case the provisions of [AGPLv3] License are
 * applicable instead of those above. If you wish to allow use of your
 * version of this file only under the terms of the [AGPLv3] License
 * and not to allow others to use your version of this file under the
 * CPAL, indicate your decision by deleting the provisions above and
 * replace them with the notice and other provisions required by the
 * [AGPLv3] License. If you do not delete the provisions above, a
 * recipient may use your version of this file under either the CPAL
 * or the [AGPLv3] License.”
 */

/*global CSL: true */

CSL.Node.layout = {
    build: function (state, target) {
        var func, prefix_token, suffix_token, tok;

        if (this.tokentype === CSL.START) {
            func = function (state, Item, item) {

                if (state.opt.development_extensions.apply_citation_wrapper
                    && state.sys.wrapCitationEntry
                    && !state.tmp.just_looking
                    && Item.system_id 
                    && state.tmp.area === "citation") { 

                    cite_entry = new CSL.Token("group", CSL.START);
                    cite_entry.decorations = [["@cite", "entry"]];
                    state.output.startTag("cite_entry", cite_entry);
                    state.output.current.value().item_id = Item.system_id;
                    if (item) {
                        state.output.current.value().locator_txt = item.locator_txt;
                        state.output.current.value().suffix_txt = item.suffix_txt;
                    }
                }
            }
            this.execs.push(func);
        }

        if (this.tokentype === CSL.START && !state.tmp.cite_affixes) {
            //
            // done_vars is used to prevent the repeated
            // rendering of variables
            //
            // initalize done vars
            func = function (state, Item) {
                state.tmp.done_vars = [];
                if (!state.tmp.just_looking && state.registry.registry[Item.id].parallel) {
                    state.tmp.done_vars.push("first-reference-note-number");
                }
                //CSL.debug(" === init rendered_name === ");
                state.tmp.rendered_name = false;
                state.tmp.name_node = {};
            };
            this.execs.push(func);
            // set opt delimiter
            func = function (state, Item) {
                // just in case
                state.tmp.sort_key_flag = false;
            };
            this.execs.push(func);
            
            // reset nameset counter [all nodes]
            func = function (state, Item) {
                state.tmp.nameset_counter = 0;
            };
            this.execs.push(func);

            func = function (state, Item) {
                var tok = "empty";
                if (state.opt.development_extensions.rtl_support) {
                    if (["ar", "he", "fa", "ur", "yi", "ps", "syr"].indexOf(Item.language) > -1) {
                        // Force correct text direction of this cite if necessary.
                        //print("DO 202b/202c");
                        tok = new CSL.Token();
                        tok.strings.prefix = "\u202b";
                        tok.strings.suffix = "\u202c";
                    }
                }
                state.output.openLevel(tok);
            }
            this.execs.push(func);
            target.push(this);

            if (state.opt.development_extensions.rtl_support && false) {
                //print("INSERT 200e into: " + this.strings.prefix);
                this.strings.prefix = this.strings.prefix.replace(/\((.|$)/g,"(\u200e$1");
                this.strings.suffix = this.strings.suffix.replace(/\)(.|$)/g,")\u200e$1");
            }

            if (state.build.area === "citation") {
                prefix_token = new CSL.Token("text", CSL.SINGLETON);
                func = function (state, Item, item) {
                    var sp;
                    if (item && item.prefix) {
                        sp = "";
                        // We need the raw string, without decorations
                        // of any kind. Markup scheme is known, though, so
                        // markup can be safely stripped at string level.
                        var prefix = item.prefix.replace(/<[^>]+>/g, "").replace(/\s+$/, "").replace(/^\s+/, "");
                        if (prefix.match(CSL.ENDSWITH_ROMANESQUE_REGEXP)) {
                            sp = " ";
                        }
                        var ignorePredecessor = false;
                        if (CSL.TERMINAL_PUNCTUATION.slice(0,-1).indexOf(prefix.slice(-1)) > -1
                            && prefix[0] != prefix[0].toLowerCase()) {
                            state.tmp.term_predecessor = false;
                            ignorePredecessor = true;
                        }
                        // Protect against double spaces, which would trigger an extra,
                        // explicit, non-breaking space.
                        prefix = (item.prefix + sp).replace(/\s+/g, " ");
                        state.output.append(prefix, this, false, ignorePredecessor);
                    }
                };
                prefix_token.execs.push(func);
                target.push(prefix_token);
            }
        }

        // Cast token to be used in one of the configurations below.
        var my_tok;
        if (this.locale_raw) {
            my_tok = new CSL.Token("dummy", CSL.START);
            my_tok.locale = this.locale_raw;
            my_tok.strings.delimiter = this.strings.delimiter;
            my_tok.strings.suffix = this.strings.suffix;
            if (!state.tmp.cite_affixes) {
                state.tmp.cite_affixes = {};
            }
        }

        if (this.tokentype === CSL.START) {
            state.build.layout_flag = true;
                            
            // Only run the following once, to set up the final layout node ...
            if (!this.locale_raw) {
                //
                // save out decorations for flipflop processing [final node only]
                //
                state[state.tmp.area].opt.topdecor = [this.decorations];
                state[(state.tmp.area + "_sort")].opt.topdecor = [this.decorations];

                state[state.build.area].opt.layout_prefix = this.strings.prefix;
                state[state.build.area].opt.layout_suffix = this.strings.suffix;
                state[state.build.area].opt.layout_delimiter = this.strings.delimiter;

                state[state.build.area].opt.layout_decorations = this.decorations;
                
                // Only do this if we're running conditionals
                if (state.tmp.cite_affixes) {
                    // if build_layout_locale_flag is true,
                    // write cs:else START to the token list.
                    tok = new CSL.Token("else", CSL.START);
                    CSL.Node["else"].build.call(tok, state, target);
                }

            } // !this.locale_raw

            // Conditionals
            if (this.locale_raw) {
                if (!state.build.layout_locale_flag) {
                    // if layout_locale_flag is untrue,
                    // write cs:choose START and cs:if START
                    // to the token list.
                    var choose_tok = new CSL.Token("choose", CSL.START);
                    CSL.Node.choose.build.call(choose_tok, state, target);
                    my_tok.name = "if";
                    CSL.Attributes["@locale-internal"].call(my_tok, state, this.locale_raw);
                    CSL.Node["if"].build.call(my_tok, state, target);
                } else {
                    // if build_layout_locale_flag is true,
                    // write cs:else-if START to the token list.
                    my_tok.name = "else-if";
                    CSL.Attributes["@locale-internal"].call(my_tok, state, this.locale_raw);
                    CSL.Node["else-if"].build.call(my_tok, state, target);
                }
                // cite_affixes for this node
                state.tmp.cite_affixes[my_tok.locale] = {};
                state.tmp.cite_affixes[my_tok.locale].delimiter = this.strings.delimiter;
                state.tmp.cite_affixes[my_tok.locale].suffix = this.strings.suffix;
            }
        }
        if (this.tokentype === CSL.END) {
            if (this.locale_raw) {
                if (!state.build.layout_locale_flag) {
                    // If layout_locale_flag is untrue, write cs:if END
                    // to the token list.
                    my_tok.name = "if";
                    my_tok.tokentype = CSL.END;
                    CSL.Attributes["@locale-internal"].call(my_tok, state, this.locale_raw);
                    CSL.Node["if"].build.call(my_tok, state, target);
                    state.build.layout_locale_flag = true;
                } else {
                    // If layout_locale_flag is true, write cs:else-if END
                    // to the token list.
                    my_tok.name = "else-if";
                    my_tok.tokentype = CSL.END;
                    CSL.Attributes["@locale-internal"].call(my_tok, state, this.locale_raw);
                    CSL.Node["else-if"].build.call(my_tok, state, target);
                }
            }
            if (!this.locale_raw) {
                // Only add this if we're running conditionals
                if (state.tmp.cite_affixes) {
                    // If layout_locale_flag is true, write cs:else END
                    // and cs:choose END to the token list.
                    if (state.build.layout_locale_flag) {
                        tok = new CSL.Token("else", CSL.END);
                        CSL.Node["else"].build.call(tok, state, target);
                        tok = new CSL.Token("choose", CSL.END);
                        CSL.Node.choose.build.call(tok, state, target);
                    }
                }
                state.build_layout_locale_flag = true;
                if (state.build.area === "citation") {
                    suffix_token = new CSL.Token("text", CSL.SINGLETON);
                    func = function (state, Item, item) {
                        var sp;
                        if (item && item.suffix) {
                            sp = "";
                            if (item.suffix.match(CSL.STARTSWITH_ROMANESQUE_REGEXP)) {
                                sp = " ";
                            }
                            state.output.append((sp + item.suffix), this);
                        }
                    };
                    suffix_token.execs.push(func);
                    target.push(suffix_token);
                }

                // mergeoutput
                func = function (state, Item) {
                    if (state.tmp.area === "bibliography") {
                        if (state.bibliography.opt["second-field-align"]) {
                            // closes bib_other
                            state.output.endTag();
                        }
                    }
                    state.output.closeLevel();
                };
                this.execs.push(func);
                func = function (state, Item) {
                    if (state.opt.development_extensions.apply_citation_wrapper
                        && state.sys.wrapCitationEntry
                        && !state.tmp.just_looking
                        && Item.system_id 
                        && state.tmp.area === "citation") { 
                        
                        state.output.endTag(); // closes citation link wrapper
                    }
                }
                this.execs.push(func);
                target.push(this);
                state.build.layout_flag = false;
                state.build.layout_locale_flag = false;
            } // !this.layout_raw
        }
    }
};
