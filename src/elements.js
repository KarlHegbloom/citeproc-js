/*
 * Copyright (c) Frank G. Bennett, Jr. 2009. All Rights Reserved.
 *
 * The contents of this file are subject to the Common Public
 * Attribution License Version 1.0 (the “License”); you may not use
 * this file except in compliance with the License. You may obtain a
 * copy of the License at:
 *
 * http://bitbucket.org/fbennett/citeproc-js/src/tip/LICENSE.
 *
 * The License is based on the Mozilla Public License Version 1.1 but
 * Sections 14 and 15 have been added to cover use of software over a
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
 * under the ./std subdirectory of the distribution archive.
 *
 * The Original Developer is not the Initial Developer and is
 * __________. If left blank, the Original Developer is the Initial
 * Developer.
 *
 * The Initial Developer of the Original Code is Frank G. Bennett,
 * Jr. All portions of the code written by Frank G. Bennett, Jr. are
 * Copyright (c) Frank G. Bennett, Jr. 2009. All Rights Reserved.
 */
dojo.provide("csl.elements");


/**
 * Functions corresponding to CSL element names.
 * <p>These are static function used during build and
 * configuration.  The <code>build</code> method is called
 * on a token generated from the XML node at build time, and
 * may manipulate either the content of the state object or that
 * of the token.</p>
 * <p>The <code>configure</code> method is invoked on the
 * node during a back-to-front pass through the tokens,
 * and sets skip positions for conditionals.</p>
 * <p>Tokens that do not affect citation rendering in any
 * way can be discarded by not pushing them to the target.
 * In this case, the <code>configure</code> method need
 * not be defined.</p>
 * @class
 */
CSL.Lib.Elements = {};


/**
 * The info element.
 * <p>Everything in this scope is a total
 * <code>noop</code>.</p>
 * @name CSL.Lib.Elements.info
 */
CSL.Lib.Elements.info = new function(){
	this.build = build;
	function build (state,target){
		if (this.tokentype == CSL.START){
			state.build.skip = "info";
		} else {
			state.build.skip = false;
		}
	};
};

CSL.Lib.Elements.macro = new function(){
	this.build = build;
	function build (state,target){
	};
};
/**
 * The text element.
 * @name CSL.Lib.Elements.text
 * @function
 */
CSL.Lib.Elements.text = new function(){
	this.build = build;
	function build (state,target){
		CSL.Util.substituteStart.call(this,state,target);
		if (this.postponed_macro){
			CSL.Factory.expandMacro.call(state,this);
		} else {
			// ...
			//
			// Do non-macro stuff
			var variable = this.variables[0];
			var form = "long";
			var plural = 0;
			if (this.strings.form){
				form = this.strings.form;
			}
			if (this.strings.plural){
				plural = this.strings.plural;
			}
			if ("citation-number" == variable || "year-suffix" == variable || "citation-label" == variable){
				//
				// citation-number and year-suffix are super special,
				// because they are rangeables, and require a completely
				// different set of formatting parameters on the output
				// queue.
				if (variable == "citation-number"){
					//this.strings.is_rangeable = true;
					if ("citation-number" == state[state.tmp.area].opt["collapse"]){
						this.range_prefix = "-";
					}
					this.successor_prefix = state[state.build.area].opt.layout_delimiter;
					var func = function(state,Item){
						var id = Item["id"];
						if (!state.tmp.force_subsequent){
							if (Item["author-only"]){
								state.tmp.element_trace.replace("do-not-suppress-me");
								var term = CSL.Output.Formatters["capitalize-first"](state,state.getTerm("references","long","singular"));
								state.output.append(term+" ");
								state.tmp.last_element_trace = true;
							};
							if (Item["suppress-author"]){
								if (state.tmp.last_element_trace){
									state.tmp.element_trace.replace("suppress-me");
								};
								state.tmp.last_element_trace = false;
							};
							var num = state.registry.registry[id].seq;
							var number = new CSL.NumericBlob(num,this);
							state.output.append(number,"literal");
						};
					};
					this["execs"].push(func);
				} else if (variable == "year-suffix"){

					state.opt.has_year_suffix = true;

					if (state[state.tmp.area].opt.collapse == "year-suffix-ranged"){
						this.range_prefix = "-";
					}
					if (state[state.tmp.area].opt["year-suffix-delimiter"]){
						this.successor_prefix = state[state.build.area].opt["year-suffix-delimiter"];
					}
					var func = function(state,Item){
						if (state.registry.registry[Item.id] && state.registry.registry[Item.id].disambig[2]){
							//state.output.append(state.registry.registry[Item.id].disambig[2],this);
							var num = parseInt(state.registry.registry[Item.id].disambig[2], 10);
							var number = new CSL.NumericBlob(num,this);
							var formatter = new CSL.Util.Suffixator(CSL.SUFFIX_CHARS);
							number.setFormatter(formatter);
							state.output.append(number,"literal");
							//
							// don't ask :)
							// obviously the variable naming scheme needs
							// a little touching up
							var firstoutput = state.tmp.term_sibling.mystack.indexOf(true) == -1;
							var specialdelimiter = state[state.tmp.area].opt["year-suffix-delimiter"];
							if (firstoutput && specialdelimiter && !state.tmp.sort_key_flag){
								state.tmp.splice_delimiter = state[state.tmp.area].opt["year-suffix-delimiter"];
							}
						}
					};
					this["execs"].push(func);
				} else if (variable == "citation-label"){
					state.opt.has_year_suffix = true;
					var func = function(state,Item){
						var label = Item["citation-label"];
						if (!label){
							//
							// A shot in the dark
							//
							var myname = state.getTerm("references","short",0);
							for each (var n in CSL.CREATORS){
								if (Item[n]){
									var names = Item[n];
									if (names && names.length){
										var name = names[0];
									}
									if (name && name.family){
										myname = name.family.replace(/\s+/,"");
									} else if (name && name.literal){
										myname = name.literal;
										var m = myname.toLowerCase().match(/^(a|the|an)(.*)/,"");
										if (m){
											myname = m[2];
										}
									}
								}
							}
							var year = "0000";
							if (Item.issued){
								var dp = Item.issued["date-parts"];
								if (dp && dp[0] && dp[0][0]){
									year = ""+dp[0][0];
								}
							}
							label = myname + year;
						};
						var suffix = "";
						if (state.registry.registry[Item.id] && state.registry.registry[Item.id].disambig[2]){
							var num = parseInt(state.registry.registry[Item.id].disambig[2], 10);
							suffix = state.fun.suffixator.format(num);
						};
						label += suffix;
						state.output.append(label,this);
					};
					this["execs"].push(func);
				};
			} else {
				if (state.build.term){
					var term = state.build.term;
					term = state.getTerm(term,form,plural);
					if (this.strings["strip-periods"]){
						term = term.replace(/\./g,"");
					};
					var printterm = function(state,Item){
						// capitalize the first letter of a term, if it is the
						// first thing rendered in a citation (or if it is
						// being rendered immediately after terminal punctuation,
						// I guess, actually).
						if (!state.tmp.term_predecessor){
							//CSL.debug("Capitalize");
							term = CSL.Output.Formatters["capitalize-first"](state,term);
							state.tmp.term_predecessor = true;
						};
						state.output.append(term,this);
					};
					this["execs"].push(printterm);
					state.build.term = false;
					state.build.form = false;
					state.build.plural = false;
				} else if (this.variables.length){
					if (this.variables[0] == "container-title" && form == "short"){
						// Define function to check container title
						var func = function(state,Item){
							var defaultval = state.getVariable(Item,this.variables[0],form);
							var value = "";
							if (state.opt["container-title-abbreviations"]){
								value = state.opt["container-title-abbreviations"][defaultval];
							};
							if (!value){
								value = Item["journalAbbreviation"];
							}
							if (!value){
								value = defaultval;
							}
							state.output.append(value,this);
						};
					} else if (this.variables[0] == "title"){
						if (state.build.area.slice(-5) == "_sort"){
							var func = function(state,Item){
								var value = Item[this.variables[0]];
								if (value){
									value = state.getTextSubField(value,"locale-sort",true);
									state.output.append(value,this);
								};
							};
						} else {
							var func = function(state,Item){
								var value = Item[this.variables[0]];
								if (value){
									var primary = state.getTextSubField(value,"locale-pri",true);
									var secondary = state.getTextSubField(value,"locale-sec");

									if (secondary){
										var primary_tok = new CSL.Factory.Token("text",CSL.SINGLETON);
										var secondary_tok = new CSL.Factory.Token("text",CSL.SINGLETON);
										for (var i in this.strings){
											secondary_tok.strings[i] = this.strings[i];
											if (i == "suffix"){
												secondary_tok.strings.suffix = "]"+secondary_tok.strings.suffix;
												continue;
											} else if (i == "prefix"){
												secondary_tok.strings.prefix = " ["+secondary_tok.strings.prefix;
											}
											primary_tok.strings[i] = this.strings[i];
										}
										state.output.append(primary,primary_tok);
										state.output.append(secondary,secondary_tok);
									} else {
										state.output.append(primary,this);
									}
								};
							};
						};
					} else if (this.variables[0] == "page-first"){
						var func = function(state,Item){
							var value = state.getVariable(Item,"page",form);
							value = value.replace(/-.*/,"");
							state.output.append(value,this);
						};
					} else if (this.variables[0] == "page"){
						var func = function(state,Item){
							var value = state.getVariable(Item,"page",form);
							value = state.fun.page_mangler(value);
							state.output.append(value,this);
						};
					} else {
						var func = function(state,Item){
							var value = state.getVariable(Item,this.variables[0],form);
							state.output.append(value,this);
						};
					};
					this["execs"].push(func);
				} else if (this.strings.value){
					var func = function(state,Item){
						state.output.append(this.strings.value,this);
					};
					this["execs"].push(func);
				} else {
					var weird_output_function = function(state,Item){
						if (state.tmp.value.length){
							CSL.debug("Weird output pattern.  Can this be revised?");
							for each (var val in state.tmp.value){
								state.output.append(val,this);
							}
							state.tmp.value = new Array();
						}
					};
					this["execs"].push(weird_output_function);
				}
			}
			target.push(this);
		};
		CSL.Util.substituteEnd.call(this,state,target);
	};
};


/**
 * The group node, start and end.
 * @name CSL.Lib.Elements.group
 * @function
 */
CSL.Lib.Elements.group = new function(){
	this.build = build;
	function build (state,target){
		if (this.tokentype == CSL.START){
			CSL.Util.substituteStart.call(this,state,target);
			if (state.build.substitute_level.value()){
				state.build.substitute_level.replace((state.build.substitute_level.value()+1));
			}
			if (CSL.GROUP_CLASSES.indexOf(this.strings.cls) > -1){
				this.decorations.push(["@display",this.strings.cls]);
			};
			var newoutput = function(state,Item){
				state.output.startTag("group",this);
			};
			//
			// Paranoia.  Assure that this init function is the first executed.
			var execs = new Array();
			execs.push(newoutput);
			this.execs = execs.concat(this.execs);

			var fieldcontentflag = function(state,Item){
				state.tmp.term_sibling.push( undefined, CSL.LITERAL );
			};
			this["execs"].push(fieldcontentflag);
		} else {
			var quashnonfields = function(state,Item){
				var flag = state.tmp.term_sibling.value();
				if (false == flag){
					state.output.clearlevel();
				}
				state.tmp.term_sibling.pop();
				//
				// Heals group quashing glitch with nested groups.
				//
				if (flag && state.tmp.term_sibling.mystack.length > 1){
					state.tmp.term_sibling.replace(true);
				}
			};
			this["execs"].push(quashnonfields);

			var mergeoutput = function(state,Item){
				//
				// rendering happens inside the
				// merge method, by applying decorations to
				// each token to be merged.
				state.output.endTag();
			};
			this["execs"].push(mergeoutput);
		}
		target.push(this);

		if (this.tokentype == CSL.END){
			if (state.build.substitute_level.value()){
				state.build.substitute_level.replace((state.build.substitute_level.value()-1));
			}
			CSL.Util.substituteEnd.call(this,state,target);
		}
	}
};

/**
 * Citation element
 */
CSL.Lib.Elements.citation = new function(){
	this.build = build;

	function build (state,target){
		if (this.tokentype == CSL.START) {

			state.fixOpt(this,"names-delimiter","delimiter");
			state.fixOpt(this,"name-delimiter","delimiter");
			state.fixOpt(this,"name-form","form");
			state.fixOpt(this,"and","and");
			state.fixOpt(this,"delimiter-precedes-last","delimiter-precedes-last");
			state.fixOpt(this,"initialize-with","initialize-with");
			state.fixOpt(this,"name-as-sort-order","name-as-sort-order");
			state.fixOpt(this,"sort-separator","sort-separator");

			state.fixOpt(this,"et-al-min","et-al-min");
			state.fixOpt(this,"et-al-use-first","et-al-use-first");
			state.fixOpt(this,"et-al-subsequent-min","et-al-subsequent-min");
			state.fixOpt(this,"et-al-subsequent-use-first","et-al-subsequent-use-first");

			state.build.area_return = state.build.area;
			state.build.area = "citation";
		}
		if (this.tokentype == CSL.END) {
			state.build.area = state.build.area_return;
		}
	}
};

/**
 * The choose node, start and end.
 * @name CSL.Lib.Elements.choose
 * @function
 */
CSL.Lib.Elements.choose = new function(){
	this.build = build;
	this.configure = configure;
	function build (state,target){
		if (this.tokentype == CSL.START){
			var func = function(state,Item){ //open condition
				state.tmp.jump.push(undefined, CSL.LITERAL);
			};
		}
		if (this.tokentype == CSL.END){
			var func = function(state,Item){ //close condition
				state.tmp.jump.pop();
			};
		}
		this["execs"].push(func);
		target.push(this);
	}
	function configure(state,pos){
		if (this.tokentype == CSL.END){
			state.configure["fail"].push((pos));
			state.configure["succeed"].push((pos));
		} else {
			state.configure["fail"].pop();
			state.configure["succeed"].pop();
		}
	}
};


/**
 * The if node, start and end.
 * @name CSL.Lib.Elements.if
 * @function
 */
CSL.Lib.Elements["if"] = new function(){
	this.build = build;
	this.configure = configure;
	function build (state,target){
		if (this.tokentype == CSL.START){
			//for each (var variable in this.variables){
			//	CSL.debug("outside function: "+variable);
			//	var func = function(state,Item){
			//		CSL.debug("inside function: "+variable);
			//		if (Item[variable]){
			//			CSL.debug("found: "+variable);
			//			return true;
			//		}
			//		return false;
			//	};
			//	this["tests"].push(func);
			//};
			if (this.strings.position){
				var tryposition = this.strings.position;
				var func = function(state,Item){
					if (state.tmp.force_subsequent && tryposition < 2){
						return true;
					} else if (Item["position"] && Item["position"] >= tryposition){
						return true;
					};
					return false;
				};
				this.tests.push(func);
			}
			if (this.strings["near-note-distance-check"]){
				var func = function (state,Item){
					if (state.tmp.force_subsequent){
						return true;
					} else if (!Item["note_distance"]){
					return false;
					} else {
						if (Item["note_distance"] > state.citation.opt["near-note-distance"]){
							return false;
						} else {
							return true;
						};
					};
				};
				this.tests.push(func);
			};
			if (! this.evaluator){
				//
				// cut and paste of "any"
				this.evaluator = state.fun.match.any;
			};
		}
		if (this.tokentype == CSL.END){
			var closingjump = function(state,Item){
				var next = this[state.tmp.jump.value()];
				return next;
			};
			this["execs"].push(closingjump);
		};
		target.push(this);
	}
	function configure(state,pos){
		if (this.tokentype == CSL.START){
			// jump index on failure
			this["fail"] = state.configure["fail"].slice(-1)[0];
			this["succeed"] = this["next"];
		} else {
			// jump index on success
			this["succeed"] = state.configure["succeed"].slice(-1)[0];
			this["fail"] = this["next"];
		}
	}
};


/**
 * The else-if node, start and end.
 * @name CSL.Lib.Elements.else-if
 * @function
 */
CSL.Lib.Elements["else-if"] = new function(){
	this.build = build;
	this.configure = configure;
	//
	// these function are the same as those in if, might just clone
	function build (state,target){
		if (this.tokentype == CSL.START){
			//for each (var variable in this.variables){
			//	var func = function(state,Item){
			//		if (Item[variable]){
			//			return true;
			//		}
			//		return false;
			//	};
			//	this["tests"].push(func);
			//};
			if (this.strings.position){
				var tryposition = this.strings.position;
				var func = function(state,Item){
					if (state.tmp.force_subsequent && tryposition < 2){
						return true;
					} else if (Item["position"] && Item["position"] >= tryposition){
						return true;
					};
					return false;
				};
				this.tests.push(func);
			}
			if (! this.evaluator){
				//
				// cut and paste of "any"
				this.evaluator = state.fun.match.any;
			};
		}
		if (this.tokentype == CSL.END){
			var closingjump = function(state,Item){
				var next = this[state.tmp.jump.value()];
				return next;
			};
			this["execs"].push(closingjump);
		};
		target.push(this);
	}
	function configure(state,pos){
		if (this.tokentype == CSL.START){
			// jump index on failure
			this["fail"] = state.configure["fail"].slice(-1)[0];
			this["succeed"] = this["next"];
			state.configure["fail"][(state.configure["fail"].length-1)] = pos;
		} else {
			// jump index on success
			this["succeed"] = state.configure["succeed"].slice(-1)[0];
			this["fail"] = this["next"];
		}
	}
};


/**
 * The else node, start and end.
 * @name CSL.Lib.Elements.else
 * @function
 */
CSL.Lib.Elements["else"] = new function(){
	this.build = build;
	this.configure = configure;
	function build (state,target){
		target.push(this);
	}
	function configure(state,pos){
		if (this.tokentype == CSL.START){
			state.configure["fail"][(state.configure["fail"].length-1)] = pos;
		}
	}
};


/**
 * The name node.
 * @name CSL.Lib.Elements.name
 * @function
 */
CSL.Lib.Elements.name = new function(){
	this.build = build;
	function build(state,target){

		state.fixOpt(this,"name-delimiter","delimiter");
		state.fixOpt(this,"name-form","form");
		//
		// Okay, there's a problem with these.  Each of these is set
		// on the name object, but must be accessible at the closing of
		// the enclosing names object.  How did I do this before?
		//
		// Boosting to tmp seems to be the current strategy, and although
		// that's very messy, it does work.  It would be simple enough
		// to extend the function applied to initialize-with below (which
		// tests okay) to the others.  Probably that's the best short-term
		// solution.
		//
		// The boost to tmp could be a boost to build, instead.  That would
		// limit the jiggery-pokery and overhead to the compile phase.
		// Might save a few trees, in aggregate.
		//
		state.fixOpt(this,"and","and");
		state.fixOpt(this,"delimiter-precedes-last","delimiter-precedes-last");
		state.fixOpt(this,"initialize-with","initialize-with");
		state.fixOpt(this,"name-as-sort-order","name-as-sort-order");
		state.fixOpt(this,"sort-separator","sort-separator");

		state.fixOpt(this,"et-al-min","et-al-min");
		state.fixOpt(this,"et-al-use-first","et-al-use-first");
		state.fixOpt(this,"et-al-subsequent-min","et-al-subsequent-min");
		state.fixOpt(this,"et-al-subsequent-use-first","et-al-subsequent-use-first");

		state.build.nameattrs = new Object();
		for each (attrname in CSL.NAME_ATTRIBUTES){
			state.build.nameattrs[attrname] = this.strings[attrname];
		}

		state.build.form = this.strings.form;
		state.build.name_flag = true;

			var set_et_al_params = function(state,Item){
				if (Item.position || state.tmp.force_subsequent){
						if (! state.tmp["et-al-min"]){
							if (this.strings["et-al-subsequent-min"]){
								state.tmp["et-al-min"] = this.strings["et-al-subsequent-min"];
							} else {
								state.tmp["et-al-min"] = this.strings["et-al-min"];
							}
						}
						if (! state.tmp["et-al-use-first"]){
							if (this.strings["et-al-subsequent-use-first"]){
								state.tmp["et-al-use-first"] = this.strings["et-al-subsequent-use-first"];
							} else {
								state.tmp["et-al-use-first"] = this.strings["et-al-use-first"];
							}
						}
				} else {
						if (! state.tmp["et-al-min"]){
							state.tmp["et-al-min"] = this.strings["et-al-min"];
						}
						if (! state.tmp["et-al-use-first"]){
							state.tmp["et-al-use-first"] = this.strings["et-al-use-first"];
						}
				}
			};
			this["execs"].push(set_et_al_params);

		var func = function(state,Item){
			state.output.addToken("name",false,this);
		};
		this["execs"].push(func);

		//var set_initialize_with = function(state,Item){
		//	state.tmp["initialize-with"] = this.strings["initialize-with"];
		//};
		//this["execs"].push(set_initialize_with);


		target.push(this);
	};
};


/**
 * The name node.
 * @name CSL.Lib.Elements.name-part
 * @function
 */
CSL.Lib.Elements["name-part"] = new function(){
	this.build = build;
	function build(state,target){
		var set_namepart_format = function(state,Item){
			state.output.addToken(state.tmp.namepart_type,false,this);
		};
		this["execs"].push(set_namepart_format);
		target.push(this);
	};
};


/**
 * The label node.
 * <p>A plural-sensitive localized label.</p>
 * @name CSL.Lib.Elements.label
 * @function
 */
CSL.Lib.Elements.label = new function(){
	this.build = build;
	/*
	 * Account for form option.
	 */
	function build(state,target){
		if (state.build.name_flag){
			this.strings.label_position = CSL.AFTER;
		} else {
			this.strings.label_position = CSL.BEFORE;
		}
		var set_label_info = function(state,Item){
			state.output.addToken("label",false,this);
		};
		this["execs"].push(set_label_info);
		if (state.build.term){
			var term = state.build.term;
			var plural = 0;
			if (!this.strings.form){
				this.strings.form = "long";
			}
			var form = this.strings.form;
			if ("number" == typeof this.strings.plural){
				plural = this.strings.plural;
				CSL.debug("plural: "+this.strings.plural);
			}
			var output_label = function(state,Item){
				if ("locator" == term){
					myterm = Item["label"];
				}
				if (!myterm){
					myterm = "page";
				}
				var myterm = state.getTerm(myterm,form,plural);
				if (this.strings["include-period"]){
					myterm += ".";
				}
				state.output.append(myterm,this);
			};
			this.execs.push(output_label);
			state.build.plural = false;
			state.build.term = false;
			state.build.form = false;
		}
		target.push(this);
	};
};


/**
 * The substitute node.
 * <p>A special conditional environment for use inside a names node.
 * Just used to record whether a name was found in the main element.</p>
 * @name CSL.Lib.Elements.substitute
 * @function
 */
CSL.Lib.Elements.substitute = new function(){
	this.build = build;
	function build(state,target){
		if (this.tokentype == CSL.START){
			var set_conditional = function(state,Item){
				state.tmp.can_block_substitute = true;
				if (state.tmp.value.length){
					state.tmp.can_substitute.replace(false, CSL.LITERAL);
				}
			};
			this.execs.push(set_conditional);
		};
		target.push(this);
	};
};


/**
 * The et-al node.
 * <p>This is a formatting hook for the et-al string
 * that is appended to truncated name sets.  It also
 * permits the specification of the "and others" localized
 * term for use instead of the standard et-al string.</p>
 */
CSL.Lib.Elements["et-al"] = new function(){
	this.build = build;
	function build(state,target){
		var set_et_al_format = function(state,Item){
			state.output.addToken("etal",false,this);
		};
		this["execs"].push(set_et_al_format);
		target.push(this);
	};
};


/**
 * The layout node.
 * <p>The tag environment that marks the end of option declarations
 * and encloses the renderable tags.</p>
 * @name CSL.Lib.Elements.layout
 * @function
 */
CSL.Lib.Elements.layout = new function(){
	this.build = build;
	function build(state,target){
		if (this.tokentype == CSL.START){
			state.build.layout_flag = true;
			//
			// done_vars is used to prevent the repeated
			// rendering of variables
			var initialize_done_vars = function(state,Item){
				state.tmp.done_vars = new Array();
				//CSL.debug("== init rendered_name ==");
				state.tmp.rendered_name = false;
			};
			this.execs.push(initialize_done_vars);

			var set_opt_delimiter = function(state,Item){
				// just in case
				state.tmp.sort_key_flag = false;
				state[state.tmp.area].opt.delimiter = "";
				if (this.strings.delimiter){
					state[state.tmp.area].opt.delimiter = this.strings.delimiter;
				};
			};
			this["execs"].push(set_opt_delimiter);

			var reset_nameset_counter = function(state,Item){
				state.tmp.nameset_counter = 0;
			};
			this["execs"].push(reset_nameset_counter);

			state[state.build.area].opt.layout_prefix = this.strings.prefix;
			state[state.build.area].opt.layout_suffix = this.strings.suffix;
			state[state.build.area].opt.layout_delimiter = this.strings.delimiter;
			state[state.build.area].opt.layout_decorations = this.decorations;

			var declare_thyself = function(state,Item){
				state.tmp.term_predecessor = false;
				state.output.openLevel("empty");
			};
			this["execs"].push(declare_thyself);
			target.push(this);
			if (state.build.area == "citation"){
				var prefix_token = new CSL.Factory.Token("text",CSL.SINGLETON);
				var func = function(state,Item){
					if (Item["prefix"]){
						var sp = "";
						if (Item["prefix"].match(/.*[a-zA-Z\u0400-\u052f].*/)){
							var sp = " ";
						}
						state.output.append((Item["prefix"]+sp),this);
					};
				};
				prefix_token["execs"].push(func);
				target.push(prefix_token);
			}
		};
		if (this.tokentype == CSL.END){
			state.build.layout_flag = false;
			if (state.build.area == "citation"){
				var suffix_token = new CSL.Factory.Token("text",CSL.SINGLETON);
				var func = function(state,Item){
					if (Item["suffix"]){
						var sp = "";
						if (Item["suffix"].match(/.*[a-zA-Z\u0400-\u052f].*/)){
							var sp = " ";
						}
						state.output.append((sp+Item["suffix"]),this);
					};
				};
				suffix_token["execs"].push(func);
				target.push(suffix_token);
			}
			var mergeoutput = function(state,Item){
				if (state.tmp.area == "bibliography"){
					if (state.bibliography.opt["second-field-align"]){
						state.output.endTag();  // closes bib_other
					};
				};
				state.output.closeLevel();
			};
			this["execs"].push(mergeoutput);
			target.push(this);
		}
	};
};


CSL.Lib.Elements.number = new function(){
	this.build = build;
	function build(state,target){
		CSL.Util.substituteStart.call(this,state,target);
		//
		// This should push a rangeable object to the queue.
		//
		if (this.strings.form == "roman"){
			this.formatter = state.fun.romanizer;
		} else if (this.strings.form == "ordinal"){
			this.formatter = state.fun.ordinalizer;
		} else if (this.strings.form == "long-ordinal"){
			this.formatter = state.fun.long_ordinalizer;
		}
		//
		// Whether we actually stick a number object on
		// the output queue depends on whether the field
		// contains a pure number.
		//
		var push_number_or_text = function(state,Item){
			var varname = this.variables[0];
			if (varname == "page-range" || varname == "page-first"){
				varname = "page";
			};
			var num = Item[varname];
			if ("undefined" != typeof num) {
				if (this.variables[0] == "page-first"){
					var m = num.split(/\s*(&|,|-)\s*/);
					num = m[0];
				}
				var m = num.match(/\s*([0-9]+).*/);
				if (m){
					num = parseInt( m[1], 10);
					var number = new CSL.NumericBlob( num, this );
					state.output.append(number,"literal");
				} else {
					state.output.append(num, this);
				};
			};
		};
		this["execs"].push(push_number_or_text);

		target.push(this);
		CSL.Util.substituteEnd.call(this,state,target);
	};
};


CSL.Lib.Elements.date = new function(){
	this.build = build;
	function build(state,target){
		if (this.tokentype == CSL.START || this.tokentype == CSL.SINGLETON){
			//
			// If form is set, the date form comes from the locale, and date-part
			// will just tinker with the formatting.
			//
			if (this.strings.form){
				if (state.opt.dates[this.strings.form]){
					//
					// Xml: Copy a node
					//
					var datexml = state.sys.xml.nodeCopy( state.opt.dates[this.strings.form] );
					//
					// Xml: Set attribute
					//
					state.sys.xml.setAttribute( datexml, 'variable', this.variables[0] );
					if (this.strings.prefix){
						//
						// Xml: Set attribute
						//
						state.sys.xml.setAttribute( datexml, "prefix", this.strings.prefix);
					}
					if (this.strings.suffix){
						//
						// Xml: Set attribute
						//
						state.sys.xml.setAttribute( datexml, "suffix", this.strings.suffix);
					}
					//
					// Xml: Delete attribute
					//
					state.sys.xml.deleteAttribute(datexml,'form');
					if (this.strings["date-parts"] == "year"){
						//
						// Xml: Find one node by attribute and delete
						//
						state.sys.xml.deleteNodeByNameAttribute(datexml,'month');
						//
						// Xml: Find one node by attribute and delete
						//
						state.sys.xml.deleteNodeByNameAttribute(datexml,'day');
					} else if (this.strings["date-parts"] == "year-month"){
						//
						// Xml: Find one node by attribute and delete
						//
						state.sys.xml.deleteNodeByNameAttribute(datexml,'day');
					}
					//
					// pass this xml object through to state.build for
					// post processing by date-part and in END or at the finish of
					// SINGLETON.  Delete after processing.
					//
					//
					// Xml: Copy node
					//
					state.build.datexml = state.sys.xml.nodeCopy( datexml );
				};
			} else {

				CSL.Util.substituteStart.call(this,state,target);
				var set_value = function(state,Item){
					state.tmp.element_rendered_ok = false;
					state.tmp.donesies = [];
					state.tmp.dateparts = [];
					var dp = [];
					if (this.variables.length && Item[this.variables[0]]){
						var date_obj = Item[this.variables[0]];
						if (date_obj.raw){
							state.tmp.date_object = state.dateParseRaw( date_obj.raw );
						} else if (date_obj["date-parts"]) {
							state.tmp.date_object = state.dateParseArray( date_obj );
						}
						//
						// Call a function here to analyze the
						// data and set the name of the date-part that
						// should collapse for this range, if any.
						//
						// (1) build a filtered list, in y-m-d order,
						// consisting only of items that are (a) in the
						// date-parts and (b) in the *_end data.
						// (note to self: remember that season is a
						// fallback var when month and day are empty)
						for each (var part in this.dateparts){
							if ("undefined" != typeof state.tmp.date_object[(part+"_end")]){
								dp.push(part);
							} else if (part == "month" && "undefined" != typeof state.tmp.date_object["season_end"]) {
								dp.push(part);
							};
						};
						//
						// (2) Reverse the list and step through in
						// reverse order, popping each item if the
						// primary and *_end data match.
						var mypos = -1;
						for (var pos=(dp.length-1); pos>-1; pos += -1){
							var part = dp[pos];
							var start = state.tmp.date_object[part];
							var end = state.tmp.date_object[(part+"_end")];
							if (start != end){
								mypos = pos;
								break;
							};
						};
						//
						// (3) When finished, the first item in the
						// list, if any, is the date-part where
						// the collapse should occur.
						state.tmp.date_collapse_at = dp.slice(0,(mypos+1));
						//
						// The collapse itself will be done by appending
						// string output for the date, less suffix,
						// placing a delimiter on output, then then
						// doing the *_end of the range, dropping only
						// the prefix.  That should give us concise expressions
						// of ranges.
						//
						// Numeric dates should not collapse, though,
						// and should probably use a slash delimiter.
						// Scope for configurability will remain (all over
						// the place), but this will do to get this feature
						// started.
						//
					} else {
						state.tmp.date_object = false;
					}
				};
				this["execs"].push(set_value);

				var newoutput = function(state,Item){
					state.output.startTag("date",this);
					var tok = new CSL.Factory.Token("date-part",CSL.SINGLETON);
					//
					// if present, sneak in a literal here and quash the remainder
					// of output from this date.
					//
					if (state.tmp.date_object["literal"]){
						state.output.append(state.tmp.date_object["literal"],tok);
						state.tmp.date_object = {};
					}
					tok.strings.suffix = " ";
				};
				this["execs"].push(newoutput);
			};
		};
		if (this.tokentype == CSL.END || this.tokentype == CSL.SINGLETON){
			if (this.strings.form && state.build.datexml){
				// Apparently this is all that is required to compile
				// the XML chunk into the style.  Same as for macros.
				//
				var datexml = state.build.datexml;
				delete state.build.datexml;
				var navi = new state._getNavi( state, datexml );
				CSL.buildStyle.call(state,navi);
			} else {
				var mergeoutput = function(state,Item){
					state.output.endTag();
				};
				this["execs"].push(mergeoutput);
			}
		};
		target.push(this);
		if (this.tokentype == CSL.END){
			CSL.Util.substituteEnd.call(this,state,target);
		};
	};
};


CSL.Lib.Elements["date-part"] = new function(){
	this.build = build;
	function build(state,target){
		if (!this.strings.form){
			this.strings.form = "long";
		}
		if (state.build.datexml){
			for each (var decor in this.decorations){
				//
				// Xml: find one node by attribute value and set attribute value
				//
				state.sys.xml.setAttributeOnNodeIdentifiedByNameAttribute(state.build.datexml,'date-part',this.strings.name,decor[0],decor[1]);
			};
			for (var attr in this.strings){
				if (attr == "name" || attr == "prefix" || attr == "suffix"){
					continue;
				};
				//
				// Xml: find one node by attribute value and set attribute value
				//
				state.sys.xml.setAttributeOnNodeIdentifiedByNameAttribute(state.build.datexml,'date-part',this.strings.name,attr,this.strings[attr]);
			}
		} else {
			//
			// Set delimiter here, if poss.
			//
			var render_date_part = function(state,Item){
				var value = "";
				var value_end = "";
				state.tmp.donesies.push(this.strings.name);
				if (state.tmp.date_object){
					value = state.tmp.date_object[this.strings.name];
					value_end = state.tmp.date_object[(this.strings.name+"_end")];
				};
				var real = !state.tmp.suppress_decorations;
				var have_collapsed = state.tmp.have_collapsed;
				var invoked = state[state.tmp.area].opt.collapse == "year-suffix" || state[state.tmp.area].opt.collapse == "year-suffix-ranged";
				var precondition = state[state.tmp.area].opt["disambiguate-add-year-suffix"];
				if (real && precondition && invoked){
					state.tmp.years_used.push(value);
					var known_year = state.tmp.last_years_used.length >= state.tmp.years_used.length;
					if (known_year && have_collapsed){
						if (state.tmp.last_years_used[(state.tmp.years_used.length-1)] == value){
							value = false;
						};
					};
				};
				if (value){
					var bc = false;
					var ad = false;
					if ("year" == this.strings.name && parseInt(value,10) < 500 && parseInt(value,10) > 0){
						ad = state.getTerm("ad");
					};
					if ("year" == this.strings.name && parseInt(value,10) < 0){
						bc = state.getTerm("bc");
						value = (parseInt(value,10) * -1);
					};

					if (this.strings.form){
						value = CSL.Util.Dates[this.strings.name][this.strings.form](state,value);
						if (value_end){
							value_end = CSL.Util.Dates[this.strings.name][this.strings.form](state,value_end);
						}
					};
					if (state.tmp.date_collapse_at.length){
						//state.output.startTag(this.strings.name,this);
						var ready = true;
						for each (var item in state.tmp.date_collapse_at){
							if (state.tmp.donesies.indexOf(item) == -1){
								ready = false;
								break;
							}
						}
						if (ready){
							if (value_end != "0"){
								state.dateput.append(value_end,this);
							}
							state.output.append(value,this);
							var curr = state.output.current.value();
							curr.blobs[(curr.blobs.length-1)].strings.suffix="";
							state.output.append(this.strings["range-delimiter"],"empty");
							var dcurr = state.dateput.current.value();
							curr.blobs = curr.blobs.concat(dcurr);
							state.dateput.string(state,state.dateput.queue);
							state.tmp.date_collapse_at = [];
						} else {
							state.output.append(value,this);
							if (state.tmp.date_collapse_at.indexOf(this.strings.name) > -1){
								//
								// Use ghost dateput queue
								//
								if (value_end != "0"){
									state.dateput.append(value_end,this);
								}
							}
						}
					} else {
						state.output.append(value,this);
					}


					if (bc){
						state.output.append(bc);
					}
					if (ad){
						state.output.append(ad);
					}
					//state.output.endTag();
				} else if ("month" == this.strings.name) {
					//
					// No value for this target variable
					//
					if (state.tmp.date_object["season"]){
						value = ""+state.tmp.date_object["season"];
						if (value && value.match(/^[1-4]$/)){
							state.output.append(state.getTerm(("season-0"+value)),this);
						} else if (value){
							state.output.append(value,this);
						};
					};
				};
				state.tmp.value = new Array();
				if (!state.opt.has_year_suffix && "year" == this.strings.name){
					if (state.registry.registry[Item.id] && state.registry.registry[Item.id].disambig[2]){
						var num = parseInt(state.registry.registry[Item.id].disambig[2], 10);
						var number = new CSL.NumericBlob(num,this);
						var formatter = new CSL.Util.Suffixator(CSL.SUFFIX_CHARS);
						number.setFormatter(formatter);
						state.output.append(number,"literal");
					};
				};
			};
			if ("undefined" == typeof this.strings["range-delimiter"]){
				this.strings["range-delimiter"] = "-";
			}
			this["execs"].push(render_date_part);
			target.push(this);
		};
	};
};


CSL.Lib.Elements.bibliography = new function(){
	this.build = build;
	function build(state,target){
		if (this.tokentype == CSL.START){

			state.fixOpt(this,"names-delimiter","delimiter");

			state.fixOpt(this,"name-delimiter","delimiter");
			state.fixOpt(this,"name-form","form");
			state.fixOpt(this,"and","and");
			state.fixOpt(this,"delimiter-precedes-last","delimiter-precedes-last");
			state.fixOpt(this,"initialize-with","initialize-with");
			state.fixOpt(this,"name-as-sort-order","name-as-sort-order");
			state.fixOpt(this,"sort-separator","sort-separator");

			state.fixOpt(this,"et-al-min","et-al-min");
			state.fixOpt(this,"et-al-use-first","et-al-use-first");
			state.fixOpt(this,"et-al-subsequent-min","et-al-subsequent-min");
			state.fixOpt(this,"et-al-subsequent-use-first","et-al-subsequent-use-first");

			state.build.area_return = state.build.area;
			state.build.area = "bibliography";
		}
		if (this.tokentype == CSL.END){
			state.build.area = state.build.area_return;
		}
		target.push(this);
	};
};


CSL.Lib.Elements.sort = new function(){
	this.build = build;
	function build(state,target){
		if (this.tokentype == CSL.START){
			state.build.sort_flag  = true;
			state.build.area_return = state.build.area;
			state.build.area = state.build.area+"_sort";
		};
		if (this.tokentype == CSL.END){
			state.build.area = state.build.area_return;
			state.build.sort_flag  = false;
		}
	};
};


CSL.Lib.Elements.key = new function(){
	this.build = build;
	function build(state,target){
		var start_key = new CSL.Factory.Token("key",CSL.START);
		start_key.strings["et-al-min"] = this.strings["et-al-min"];
		start_key.strings["et-al-use-first"] = this.strings["et-al-use-first"];
		var initialize_done_vars = function(state,Item){
			state.tmp.done_vars = new Array();
		};
		start_key.execs.push(initialize_done_vars);

		var sort_direction = new Array();
		if (this.strings.sort_direction == CSL.DESCENDING){
			sort_direction.push(1);
			sort_direction.push(-1);
		} else {
			sort_direction.push(-1);
			sort_direction.push(1);
		}
		state[state.build.area].opt.sort_directions.push(sort_direction);

		var et_al_init = function(state,Item){
			state.tmp.sort_key_flag = true;
			if (this.strings["et-al-min"]){
				state.tmp["et-al-min"] = this.strings["et-al-min"];
			}
			if (this.strings["et-al-use-first"]){
				state.tmp["et-al-use-first"] = this.strings["et-al-use-first"];
			}
		};
		start_key["execs"].push(et_al_init);
		target.push(start_key);
		//
		// ops to initialize the key's output structures
		if (this.variables.length){
			var variable = this.variables[0];
			if (CSL.CREATORS.indexOf(variable) > -1) {
				//
				// Start tag
				var names_start_token = new CSL.Factory.Token("names",CSL.START);
				names_start_token.tokentype = CSL.START;
				names_start_token.variables = this.variables;
				CSL.Lib.Elements.names.build.call(names_start_token,state,target);
				//
				// Middle tag
				var name_token = new CSL.Factory.Token("name",CSL.SINGLETON);
				name_token.tokentype = CSL.SINGLETON;
				name_token.strings["name-as-sort-order"] = "all";
				CSL.Lib.Elements.name.build.call(name_token,state,target);
				//
				// End tag
				var names_end_token = new CSL.Factory.Token("names",CSL.END);
				names_end_token.tokentype = CSL.END;
				CSL.Lib.Elements.names.build.call(names_end_token,state,target);
			} else {
				var single_text = new CSL.Factory.Token("text",CSL.SINGLETON);
				if (variable == "citation-number"){
					var output_func = function(state,Item){
						state.output.append(state.registry.registry[Item["id"]].seq.toString(),"empty");
					};
				} else if (CSL.DATE_VARIABLES.indexOf(variable) > -1) {
					var output_func = function(state,Item){
						if (Item[variable]){
							var dp = Item[variable]["date-parts"];
							if (dp && dp[0]){
								if (dp[0].length >0){
									state.output.append(CSL.Util.Dates.year["long"](state,dp[0][0]));
								}
								if (dp[0].length >1){
									state.output.append(CSL.Util.Dates.month["numeric-leading-zeros"](state,dp[0][1]));
								}
								if (dp[0].length >2){
									state.output.append(CSL.Util.Dates.day["numeric-leading-zeros"](state,dp[0][2]));
								}
							}

						};
					};
				} else if ("title" == variable) {
					var output_func = function(state,Item){
						var value = Item[variable];
						if (value){
							value = state.getTextSubField(value,"locale-sort",true);
							state.output.append(value,"empty");
						};
					};
				} else {
					var output_func = function(state,Item){
						state.output.append(Item[variable],"empty");
					};
				};
				single_text["execs"].push(output_func);
				target.push(single_text);
			};
		} else {
			//
			// if it's not a variable, it's a macro
			var token = new CSL.Factory.Token("text",CSL.SINGLETON);
			token.postponed_macro = this.postponed_macro;
			CSL.Factory.expandMacro.call(state,token);
		}
		//
		// ops to output the key string result to an array go
		// on the closing "key" tag before it is pushed.
		// Do not close the level.
		var end_key = new CSL.Factory.Token("key",CSL.END);
		var store_key_for_use = function(state,Item){
			var keystring = state.output.string(state,state.output.queue);
			if (false){
				CSL.debug("keystring: "+keystring+" "+typeof keystring);
			}
			if ("string" != typeof keystring){
				keystring = undefined;
			}
			state[state.tmp.area].keys.push(keystring);
			state.tmp.value = new Array();
		};
		end_key["execs"].push(store_key_for_use);
		var reset_key_params = function(state,Item){
			// state.tmp.name_quash = new Object();
			state.tmp["et-al-min"] = false;
			state.tmp["et-al-use-first"] = false;
			state.tmp.sort_key_flag = false;
		};
		end_key["execs"].push(reset_key_params);
		target.push(end_key);
	};
};
