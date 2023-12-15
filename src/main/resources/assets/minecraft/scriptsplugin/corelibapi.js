//Core - Simple, yet powerful ScriptAPI base

var Core = {
    version: "4.16",
    API_V2: typeof _AdaptedModule === "undefined"
}, module, command, scriptName, scriptVersion, scriptAuthor;

/*-------------*/
/* Module core */
/*-------------*/

Core.registerModule = function (m) {
    if (!Object.keys(m).length) return;

    var settings = {}, dynamicValues;
    (m.values = toArray(m.values)).forEach(function (v, i) {
        var handler = Core.dynamicValues[v];
        if (handler) {
            v = handler.getActive(true);
            if (!dynamicValues) dynamicValues = true;
        }

        //Makes multiple "spacer" values possible
        for each (var v in toArray(v)) settings[v.getName() || ("spacer" + Object.keys(settings).length)] = v instanceof Value ? v : v.getValue();
    });

    script.registerModule({
        name: m.name || script.scriptName,
        category: Core.categories.add(m.category || "Core"),
        description: m.description || "",
        tag: m.tag || "",
        settings: settings
    }, function (module) {
        m.module = module;
        m.moduleReflector = new Reflector(module);

        m.onKey && module.on("key", m.onKey.bind(m));
        m.onJump && module.on("jump", m.onJump.bind(m));
        m.onMove && module.on("move", m.onMove.bind(m));
        m.onStep && module.on("step", m.onStep.bind(m));
        m.onWorld && module.on("world", m.onWorld.bind(m));
        m.onAttack && module.on("attack", m.onAttack.bind(m));
        m.onEnable && module.on("enable", m.onEnable.bind(m));
        m.onMotion && module.on("motion", m.onMotion.bind(m));
        m.onPacket && module.on("packet", m.onPacket.bind(m));
        m.onStrafe && module.on("strafe", m.onStrafe.bind(m));
        m.onUpdate && module.on("update", m.onUpdate.bind(m));
        m.onDisable && module.on("disable", m.onDisable.bind(m));
        m.onSession && module.on("session", m.onSession.bind(m));
        m.onRender2D && module.on("render2D", m.onRender2D.bind(m));
        m.onRender3D && module.on("render3D", m.onRender3D.bind(m));
        m.onShutdown && module.on("shutdown", m.onShutdown.bind(m));
        m.onSlowDown && module.on("slowDown", m.onSlowDown.bind(m));
        m.onClickBlock && module.on("clickBlock", m.onClickBlock.bind(m));
        m.onStepConfirm && module.on("stepConfirm", m.onStepConfirm.bind(m));
        m.onValueChanged && module.on("valueChanged", m.onValueChanged.bind(m));
        //Built-in shutdown event is only called when module is enabled, that could lead into dynamic values not getting saved. Has to be hooked artificially.
        dynamicValues && hookEvent(ClientShutdownEvent, function () Core.dynamicValues.update(m, true));

        /*-------------------------*/
        /* Artificial Events™ core */
        /*-------------------------*/

        for (var key in Core.artificialEvents) m[key] && hookEvent(Core.artificialEvents[key], m[key].bind(m), function () m.module.state, m);
    });
}

Core.hookedEvents = new java.util.HashMap();

function hookEvent(eventClass, func, handleEventsCallback, coreModule) {
    if (!(eventClass instanceof Class)) eventClass = eventClass.class;

    var listener = new (Java.extend(Listenable, java.util.function.Consumer, {
            handleEvents: handleEventsCallback ? handleEventsCallback : coreModule ? function () coreModule.module.state : function () true,
            accept: func
        })),
        targets = Core.eventManager.registry.getOrDefault(eventClass, new ArrayList()),
        hook = new EventHook(listener, getMethod(listener, "accept"), Core.defaultAnnotation);

    targets.add(hook);
    Core.hookedEvents[eventClass] = toArray(Core.hookedEvents[eventClass]).concat(hook);
    Core.eventManager.registry[eventClass] = targets;

    //Registering event in ScriptModule's events HashMap to make them callable via callEvent() function.
    if (coreModule) coreModule.moduleReflector.events[eventClass.simpleName[0].toLowerCase() + eventClass.simpleName.slice(1, -5) /*BlockBBEvent -> blockBB, ...*/] = func;
}

/*--------------*/
/* Command core */
/*--------------*/

Core.registerCommand = function (c, stale) {
    if (!Object.keys(c).length) return;

    var aliases = toArray(c.aliases || c.name || script.scriptName).toLowerCase();
    var command = new (Java.extend(Command)) (aliases[0], Java.to(aliases, "java.lang.String[]")) {
        execute: function (args) {
            try {
                args = Java.from(args);
                var formattedArgs = args.toLowerCase().slice(1), scope, subcommands, parametersMap, scopePos = 1;

                var setScope = function (obj) {
                    scope = toArray(obj);

                    subcommands = [];
                    parametersMap = new LinkedHashMap;

                    for each (var target in scope) {
                        if (isObject(target)) subcommands.pushArray(Object.keys(target));
                        else if (target instanceof Function) {
                            var paramArgs = getFunctionParameters(target);
                            if (!paramArgs.length && args.length <= scopePos + 1) return target(), true;
                            parametersMap[paramArgs] = target;
                        }
                    }
                }

                if (setScope(c.handler)) return;

                for (var i in formattedArgs) {
                    var arg = formattedArgs[i];
                    if (!subcommands.includes(arg)) {
                        for (var parameterArgs in parametersMap) {
                            if (parameterArgs.length == (formattedArgs.length - i))
                                return parametersMap[parameterArgs].apply(c.handler, args.slice(-parameterArgs.length));
                            else if ((formattedArgs.length - i) > parameterArgs.length && Math.max.apply(null, Java.from(parametersMap.keySet()).map(function (params) params.length)) == parameterArgs.length)
                                return parametersMap[parameterArgs].apply(c.handler, args.slice(+i + 1, +i + parameterArgs.length).concat(args.slice(+i + parameterArgs.length).join(" ")));
                        }
                        break
                    } else {
                        if (setScope(Array.isArray(scope) ? scope.find(function (target) isObject(target) && target[arg])[arg] : scope[arg])) return;
                        scopePos = parseInt(i) + 2;
                    }
                }

                var parameters = Java.from(parametersMap.keySet());

                clearChat();
                if (args.length == 1) {
                    print("§8▏§7§l", c.name || script.scriptName, "§8v§l" + (c.version || script.scriptVersion), "§7by§8§l", toArray(c.author || Java.from(script.scriptAuthors)).join("§7, §8§l"));
                    if (aliases.length > 1) {
                        print("§8▏ §7§lAvailable aliases§8: (§7§l" + aliases.length + "§8)");
                        print("§8▏ §f" + aliases.map(function (alias) LiquidBounce.commandManager.prefix + alias).join("§7, §f"));
                    }
                } else if (args.length != scopePos) {
                    if (parameters.length) {
                        var limitPos = scopePos + Math.max.apply(null, parameters.map(function (params) params.length));
                        print("§4▏ §c§lInvalid parameter count§4: (§c§l" + (args.length - scopePos) + "§4)");
                        if (args.length > limitPos) print("§4▏§c", args.slice(0, limitPos).join(" "), "„§4§l" + args.slice(limitPos).join("§c“ „§4§l") + "§c“");
                    } else if (subcommands.length) {
                        print("§4▏ §c§lInvalid subcommand§4:");
                        print("§4▏§c", args.slice(0, scopePos).join(" "), "„§4§l" + args[scopePos] + "§c“");
                    }
                }

                if (subcommands.length) {
                    print("§8▏ §7§lValid subcommand" + (subcommands.length > 1 ? "s" : "") + "§8: (§7§l" + subcommands.length + "§8)");
                    print("§8▏§f", args.slice(0, scopePos).join(" "), "§8[§f" + subcommands.join("§7, §f") + "§8]");
                }

                if (parameters.length) {
                    print("§8▏ §7§lValid parameters§8: (§7§l" + parameters.map(function (paramArgs) paramArgs.length).join("§8/§7§l") + "§8)");
                    for each (paramArgs in parameters) print("§8▏§f", args.slice(0, scopePos).join(" "), paramArgs.length ? "„§7" + paramArgs.map(function (param) param.replaceAll("_", " ")).join("§f“ „§7") + "§f“" : "");
                }
            } catch (e) {
                print("§4▏ §c§lFailed§c to execute command§4!");
                print(e);
            }
        },
        tabComplete: function (args) {
            args = Java.from(args);

            var options = toArray(c.onTabComplete && toArray(c.onTabComplete(args)));
            var scope = toArray(c.handler);
            for each (var arg in args.slice(0, -1).toLowerCase()) {
                if (!scope.some(function (element) {
                    if (isObject(element) && element[arg]) return scope = toArray(element[arg]);
                })) {
                    scope = null;
                    break
                }
            }
            if (scope) options.pushArray(toArray(scope.map(function (element) isObject(element) && Object.keys(element))).filter(function (string) string.startsWithIgnoreCase(args.last())));

            return Java.to(c.filterTabCompletions !== false ? options.filter(function (string) string.startsWithIgnoreCase(args.last())) : options, "java.util.List");
        }
    }

    LiquidBounce.commandManager.registerCommand(command);
    !stale && Core.registeredCommandsField.get(script).add(command);
    return command;
}

/*-------------------*/
/* Utility functions */
/*-------------------*/

function isMovingHorizontally(entity) entity && entity != mc.thePlayer ? entity.lastTickPosX != entity.posX || entity.lastTickPosZ != entity.posZ : !!(mc.thePlayer.movementInput.moveForward || mc.thePlayer.movementInput.moveStrafe);

function isMovingVertically(entity) entity && entity != mc.thePlayer ? entity.lastTickPosY != entity.posY : mc.thePlayer.movementInput.jump || mc.thePlayer.movementInput.sneak;

function isMoving(entity) isMovingHorizontally(entity) || isMovingVertically(entity);

function isInputHorizontally() Keyboard.isKeyDown(mc.gameSettings.keyBindForward.getKeyCode()) || Keyboard.isKeyDown(mc.gameSettings.keyBindLeft.getKeyCode()) || Keyboard.isKeyDown(mc.gameSettings.keyBindBack.getKeyCode()) || Keyboard.isKeyDown(mc.gameSettings.keyBindRight.getKeyCode());

function isInputVertically(jumpOnly) Keyboard.isKeyDown(mc.gameSettings.keyBindJump.getKeyCode()) || (!jumpOnly && Keyboard.isKeyDown(mc.gameSettings.keyBindSneak.getKeyCode()));

function move(horizontal, vertical, timer, event, ignoreInput) {
    horizontal = ignoreInput ? horizontal : isInputHorizontally() ? horizontal : 0;
    vertical = ignoreInput ? vertical : isInputHorizontally() ? vertical : null;
    yaw = MovementUtils.getDirection();
    timer != null && timer > 0 && (mc.timer.timerSpeed = timer);
    horizontal != null && ((mc.thePlayer.motionX = -Math.sin(yaw) * horizontal, mc.thePlayer.motionZ = Math.cos(yaw) * horizontal), (event && (event.setX(mc.thePlayer.motionX), event.setZ(mc.thePlayer.motionZ))));
    vertical != null && ((mc.thePlayer.motionY = vertical), (event && event.setY(vertical)));
}

function interval(ms, func, _timer) (_timer = new Timer("setInterval", true), _timer.schedule(func, 0, ms), _timer);

function timeout(ms, func, _timer) (_timer = new Timer("setTimeout", true), _timer.schedule(func, ms), _timer);

function setValues(module, values) {
    values = toArray(values);

    if (module instanceof ScriptModule) {
        var valuesMap = new LinkedHashMap;
        for each (var v in values) valuesMap[v.getName() || ("spacer" + valuesMap.size())] = v instanceof Value ? v : v.getValue();
        Core.ignoreValueChange = true;
        getField(module, "_values").set(module, valuesMap);
    } else if (module instanceof Module) {
        getFields(module).forEach(function (field, i) {
            field.setAccessible(true);
            getField(Field, "modifiers").setInt(field, field.getModifiers() & ~Modifier.FINAL);
            var instance = field.get(module);
            if (instance instanceof Value) {
                var suitable = values.find(function (value) instance.class.isAssignableFrom(value.class));
                field.set(module, suitable);
                values.remove(suitable);
            }
        });
    } else return

    LiquidBounce.fileManager.saveConfig(LiquidBounce.fileManager.valuesConfig);
}

function getValues(module) Java.from(module.getValues());

function getNearestTarget(entityType, fromEntity, _entity) mc.theWorld.loadedEntityList.stream().filter(function (e) e != mc.thePlayer && (entityType ? e instanceof entityType : EntityUtils.isSelected(e, true))).min(function (a, b) (_entity = fromEntity || mc.thePlayer).getDistanceToEntity(a) - _entity.getDistanceToEntity(b)).orElse(null);

function getTargetsInRange(range, entityType) Java.from(mc.theWorld.loadedEntityList).filter(function (e) e != mc.thePlayer && ((entityType ? e instanceof entityType : EntityUtils.isSelected(e, true)) && (!range || PlayerExtensionKt.getDistanceToEntityBox(e, mc.thePlayer) <= range)));

function getPlayer(nick) Java.from(mc.theWorld.playerEntities).find(function (e) StringUtils.stripControlCodes(e.getName()).equals(nick));

function rand(min /*[min, max]*/, max) (Array.isArray(min) && (min = min[0], max = min[1]), Math.random() * (max - min) + min);

function getDurability(stack) stack && stack.getMaxDamage() - stack.getItemDamage();

function getAttackDamage(stack, _item) stack && (_item = stack.getItem()) && (_item instanceof ItemSword || _item instanceof ItemTool) ? Java.from(_item.getItemAttributeModifiers().get("generic.attackDamage"))[0].getAmount() + 1.25 * ItemUtils.getEnchantment(stack, Enchantment.sharpness) : -1;

function getBreakingSpeed(stack, block, _item) stack && (_item = stack.getItem()) && (_item instanceof ItemTool) ? _item.getStrVsBlock(stack, block) : 1;

function getFacing(blockData) blockData && (blockData instanceof BlockPos ? mc.theWorld.getBlockState(blockData) : blockData).getProperties().get(BlockDirectional.FACING);

Chat = chat = { print: print = function () { ClientUtils.displayChatMessage(getArguments(arguments).join(" ")) } };

function showMessage(text, title, alwaysOnTop, type, _dialog)
    new Thread(function () {
        (_dialog = new JOptionPane(text || "", type || JOptionPane.INFORMATION_MESSAGE).createDialog(title || "")).setAlwaysOnTop(alwaysOnTop != null ? alwaysOnTop : true);
        _dialog.setVisible(true);
    }).start();

function getMethod(clazz, name, argumentArr, _method)
    ((_method = getMethods(clazz).find(function (m)
        m.getName() == name && (!argumentArr || (m.getParameterCount() == argumentArr.length && !Java.from(m.getParameterTypes()).some(function (clazz, i) {
            if (clazz.isPrimitive() && argumentArr[i] instanceof java.lang.Number) return
            return !clazz.isAssignableFrom(argumentArr[i].class)
        })))
    )) && _method.setAccessible(true), _method);

function getField(clazz, name, _field) ((_field = getFields(clazz).find(function (f) f.getName() == name)) && _field.setAccessible(true), _field);

function getFields(clazz) {
    var _fields = Java.from((clazz = clazz instanceof Class ? clazz : clazz.class).getDeclaredFields());
    while (clazz = clazz.superclass) _fields.pushArray(Java.from(clazz.getDeclaredFields()));
    return _fields;
}

function getMethods(clazz) {
    var _methods = Java.from((clazz = clazz instanceof Class ? clazz : clazz.class).getDeclaredMethods());
    while (clazz = clazz.superclass) _methods.pushArray(Java.from(clazz.getDeclaredMethods()));
    return _methods;
}

function getConstructor(clazz, index, _constructor) ((_constructor = (clazz instanceof Class ? clazz : clazz.class).getDeclaredConstructors()[index]).setAccessible(true), _constructor);

function openFolder(folder) Desktop.open(folder);

function toArray(object, notFlat) (Array.isArray(object) ? object : [object]).flat(!notFlat).filter(Boolean);

function isObject(object) object && object.constructor === Object;

function canStep(stepHeight, predictDistance) {
    if (mc.thePlayer.isCollidedHorizontally || predictDistance) {
        var yaw = MovementUtils.getDirection(), bb = mc.thePlayer.getEntityBoundingBox(), possiblePlaces = [], otherBB, predictDistance = predictDistance || 0.01;
        for (var i = 0; (i += 0.125) <= stepHeight;) {
            if (!mc.theWorld.getCollidingBoundingBoxes(mc.thePlayer, bb.offset(0, i, 0)).isEmpty()) break
            if (mc.theWorld.getCollidingBoundingBoxes(mc.thePlayer, otherBB = bb.offset(-Math.sin(yaw) * predictDistance, i, Math.cos(yaw) * predictDistance)).isEmpty() && !mc.theWorld.getCollidingBoundingBoxes(mc.thePlayer, otherBB.offset(0, -0.125, 0)).isEmpty()) possiblePlaces.push(i);
        }
        return possiblePlaces.length && Math.max.apply(null, possiblePlaces);
    }
}

function getStepHeight() {
    var yaw = MovementUtils.getDirection(), bb = mc.thePlayer.getEntityBoundingBox();
    for (var i = 0; (i += 0.125) <= 255 - mc.thePlayer.posY;) {
        if (!mc.theWorld.getCollidingBoundingBoxes(mc.thePlayer, bb.offset(0, i, 0)).isEmpty()) break
        var offsetBB = bb.offset(-Math.sin(yaw) * 0.01, i, Math.cos(yaw) * 0.01);

        if (mc.theWorld.getCollidingBoundingBoxes(mc.thePlayer, offsetBB).isEmpty()) return i;
    }
}

function callEvent(name, args) scriptManager.scripts.forEach(function (s) Core.registeredModulesField.get(s).forEach(function (m) Core.callEventMethod.invoke(m, name, args)));

function playSound(name, pitch) mc.getSoundHandler().playSound(PositionedSoundRecord.create(new ResourceLocation(name), pitch || 1));

function sendPacket(packet, triggerEvent) {
    if (!mc.getNetHandler()) return

    var networkManager = mc.getNetHandler().getNetworkManager();
    if (triggerEvent) networkManager.sendPacket(packet);
    else if (networkManager.isChannelOpen()) {
        Core.flushOutboundQueueMethod.invoke(networkManager);
        Core.dispatchPacketMethod.invoke(networkManager, packet, null);
    } else {
        Core.readWriteLockField.get(networkManager).writeLock().lock();
        try {
            var outboundPackets = Core.outboundPacketsQueueField.get(networkManager);
            outboundPackets.add(new NetworkManager.InboundHandlerTuplePacketListener(packet, null));
            Core.outboundPacketsQueueField.set(networkManager, outboundPackets);
        } finally {
            Core.readWriteLockField.get(networkManager).writeLock().unlock();
        }
    }
}

function getSRGName(clazz, name, map) {
    if (!(clazz instanceof Class)) clazz = clazz.class;
    if (map.containsKey(clazz.name)) {
        for each (var entry in map.get(clazz.name).entrySet()) {
            if (entry.getValue() == name) return entry.getKey().split("(")[0];
        }
    }
    return name;
}

function getFunctionParameters(func) {
    if (func instanceof Function) {
        var match = func.toString().match(/function.*\((.*)\)/)[1];
        if (match.length) return match.replaceAll(" ", "").split(",")
    }
    return []
}

function getArguments(argumentsObj, from, to) Array.prototype.slice.call(argumentsObj, from, to);

//Downloads a GitHub directory.
//Uses GitHub's API URL (for example https://api.github.com/repos/CzechHek/Core/contents/Scripts)
function downloadDirectory(url, destination, onSuccess, onFailure) {
    new Thread(function () {
        try {
            if (!(url instanceof URL)) url = new URL(url);
            if (!(destination instanceof File)) destination = new File(destination);

            var json = JSON.parse(HttpUtils.get(url));
            for each (var info in json) {
                if (info.type == "file") HttpUtils.download(info.download_url, new File(destination, info.name));
                else downloadDirectory(info.url, new File(destination, info.name));
            }

            onSuccess instanceof Function && onSuccess();
        } catch (e) {
            (onFailure instanceof Function ? onFailure : print)(e);
        }
    }).start();
}

//mc.ingameGUI.getChatGUI().clearChatMessages() also clears message history cache that's accessible by pressing arrow up
function clearChat() {
    if (!mc.ingameGUI) return
    var chatGui = new Reflector(mc.ingameGUI.getChatGUI());
    chatGui.drawnChatLines.clear();
    chatGui.chatLines.clear();
}

/*----------------------*/
/* Class-like functions */
/*----------------------*/

function EditableEnum(target) {
    var valuesField = getField(target, "$VALUES");
    getField(Field, "modifiers").setInt(valuesField, valuesField.getModifiers() & ~Modifier.FINAL);
    var accessor = getMethod(java.lang.reflect.Constructor, "acquireConstructorAccessor").invoke(getConstructor(target, 0)), a;

    this.add = function (name) (!(a = this.values()).some(function (v) v.getDisplayName().equalsIgnoreCase(name)) && valuesField.set(null, Java.to(a.concat(accessor.newInstance([name.toUpperCase(), 0, name])), "net.minusmc.minusbounce.features.module.ModuleCategory[]")), name);
    this.remove = function (name) (this.values().some(function (v, i, a) v.getDisplayName().equalsIgnoreCase(name) && (a.splice(i, 1), !valuesField.set(null, Java.to(a, "net.minusmc.minusbounce.features.module.ModuleCategory[]")))), name);
    this.get = function () target;
    this.values = function () Java.from(valuesField.get(null));
}

function Reflector(object) object && object instanceof java.lang.Object ?
    new JSAdapter() {
        __get__: function (name) {
            var field = getField(object, getSRGName(object, name, Core.remapperFields));
            if (field) return new Reflector(field.get(object));

            var method = getMethod(object, getSRGName(object, name, Core.remapperMethods));
            if (method) return method;

            return object[name];
        },
        __put__: function (name, value) {
            var field = getField(object, getSRGName(object, name, Core.remapperFields));
            field ? field.set(object, value) : object[name] = value;
        },
        __call__: function (name) {
            switch (name) {
                case "toString": return object + ""//.toString() doesn't work for java beans
                case "valueOf": return object;
                default:
                    args = getArguments(arguments, 1);
                    return getMethod(object, getSRGName(object, name, Core.remapperMethods), args).invoke(object, Java.to(args, "java.lang.Object[]"));
            }
        }
    } : object;

function TextEditor(file) file instanceof File && (
    file.createNewFile(),
    new JSAdapter() {
        __get__: function (name) {
            switch (name) {
                case "text": return FileUtils.readFileToString(file)
                case "file": return file
            }
        },
        __put__: function (name, value) {
            switch (name) {
                case "text":
                    FileUtils.writeStringToFile(file, value);
                    return value
                case "file": return file = value
            }
        },
        __call__: function (name, value) {
            switch (name) {
                case "toString":
                case "valueOf":
                case "getText": return this.text
                case "setText": return this.text = value
                case "getFile": return file
                case "setFile": return file = value
            }
        }
    }
);

Core.dynamicValues = {
    update: function (coreModule, forceAll) {
        if (forceAll || mc.currentScreen instanceof StyleMode)
            setValues(coreModule.module, coreModule.values.map(
                function (v) {
                    var handler = Core.dynamicValues[v];
                    return handler ? handler.getActive(forceAll) : v;
                }
            ).flat());
    },
    Handler: function (static, dynamic) {
        this.getActive = function (forceAll, _activeValues) {
            _activeValues = _activeValues || [static];

            for each (var val in dynamic) {
                for each (var subvalue in (isObject(val) ? toArray(forceAll ? Object.values(val) : val[static.get()]) : static.get() || forceAll ? toArray(val) : null)) {
                    _activeValues.push(subvalue);

                    if (Core.dynamicValues[subvalue])
                        Core.dynamicValues[subvalue].getActive(forceAll, _activeValues);
                }
            }

            return _activeValues;
        };
    }
};

value = {
    createBlock: function (name, value) new BlockValue(name, value),
    createBoolean: function (name, value, dynamic/*...*/) {
        if (!dynamic) return new BoolValue(name, value);

        var instance = new (Java.extend(BoolValue)) (name, value) {
            onChanged: function () {
                for each (var coreModule in toArray(module)) Core.dynamicValues.update(coreModule);
            }
        }

        Core.dynamicValues[instance] = new Core.dynamicValues.Handler(instance, getArguments(arguments, 2).flat());
        return instance;
    },
    createFloat: function (name, value, min, max) new FloatValue(name, value, min, max),
    createFont: function (name, value) new FontValue(name, value),
    createInteger: function (name, value, min, max) new IntegerValue(name, value, min, max),
    createList: function (name, values, value, dynamic/*...*/) {
        if (!dynamic) return new ListValue(name, values, value);

        var instance = new (Java.extend(ListValue)) (name, values, value) {
            onChanged: function () {
                for each (var coreModule in toArray(module)) Core.dynamicValues.update(coreModule);
            }
        }

        Core.dynamicValues[instance] = new Core.dynamicValues.Handler(instance, getArguments(arguments, 3).flat());
        return instance;
    },
    createText: function (name, value) new TextValue(name, value),
    createSpacer: function () new BoolValue("", false),
    createHeader: function (title, indent) {
        if (!title) return this.createSpacer();

        title = title.replace(":", "");
        var Adapter = Java.extend(TextValue),
            header = (Core.headers = Core.headers || {})[Adapter] = new Adapter(title, "") {
                onChanged: function () {
                    Core.headers[Adapter].set("");
                }
            }
        return indent ? [value.createSpacer(), header] : header;
    },
    createButton: function (name, func) {
        if (!name || !func) return

        var instance = new (Java.extend(BoolValue)) (name, false) {
            onChanged: function (o) {
                if (o) return
                instance.set(false);
                func();
            }
        }

        return instance
    }
}

/*-------------------*/
/* Object extensions */
/*-------------------*/

//Array.shuffle([boolean]) - randomizes elements order, overwrites and returns the array
//parameters: boolean - optional; false -> doesn't shuffle
Object.defineProperty(Array.prototype, "shuffle", {
    writable: true,
    value: function (bool) {
        var i = this.length, j, t;
        if (bool === false || !i) return this;
        while (--i) {
            j = ~~(Math.random() * (i + 1)),
            t = this.i;
            this.i = this.j;
            this.j = t;
        } return this;
    }
});

//Array.find(function, [boolean]) - finds the first element that fulfills a condition, returns the element or index of the element
//parameters: function - defines the condition, boolean - optional; true -> returns index
Object.defineProperty(Array.prototype, "find", {
    value: function (func, returnIndex) {
        for (var i in this) if (func(this[i], i, this)) return returnIndex ? +i : this[i];
        return returnIndex ? -1 : null;
    }
});

//Array.includes(element) - checks whether an array has specified element, returns boolean
//parameters: element - element of the array to check for
Object.defineProperty(Array.prototype, "includes", {
    value: function (element) this.indexOf(element) !== -1
});

//String.includes(string, [boolean]) - checks if a string contains other string, case sensitive / insensitive, returns boolean
//parameters: string - string to check for, boolean - optional; true -> case insensitive search
Object.defineProperty(String.prototype, "includes", {
    value: function (string, ignoreCase) ignoreCase ? this.toString().toLowerCase().contains(string.toLowerCase()) : this.toString().contains(string)
});

//Array.remove(element) - removes element from array, returns if successful
//parameters: element - element to remove
Object.defineProperty(Array.prototype, "remove", {
    value: function (element, _index) !!(~(_index = this.indexOf(element)) && this.splice(_index, 1))
});

//Array.last() - returns last element of array
Object.defineProperty(Array.prototype, "last", {
    value: function () this[this.length - 1]
});

//Array.random([from: int], [to: int]) - returns a random element (between optional boundaries)
//parameters: from - minimal index, optional; to - maximal index, optional
Object.defineProperty(Array.prototype, "random", {
    value: function (from, to) this.length > 0 ? this[Math.floor(rand(from || 0, (to + 1) || this.length))] : null
});

//Array.toLowerCase() - clones an array, all it's elements will be lowercase
Object.defineProperty(Array.prototype, "toLowerCase", {
    value: function () this.map(function (element) element.toLowerCase())
});

//Array.flat(boolean) - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat
//parameters: false -> doesn't flatten
Object.defineProperty(Array.prototype, "flat", {
    value: function (bool, _result) {
        if (bool === false) return this

        _result = _result || [];

        for each (var element in this) {
            if (Array.isArray(element)) element.flat(true, _result);
            else _result.push(element);
        }

        return _result
    }
});

//Array.pushArray(array) - pushes all elements of an array to a different array
Object.defineProperty(Array.prototype, "pushArray", {
    writable: true,
    value: function (arr) Array.prototype.push.apply(this, arr)
});

//Array.unique() - filters out all duplicates from an array and returns it
//parameters: true -> overwrites the array
Object.defineProperty(Array.prototype, "unique", {
    writable: true,
    value: function (overwrite) overwrite ? (this = this.filter(function (e, i, a) a.indexOf(e) === i)) : this.filter(function (e, i, a) a.indexOf(e) === i)
})

Object.defineProperty(String.prototype, "startsWithIgnoreCase", {
    value: function (string) this.toLowerCase().startsWith(string.toLowerCase())
});

Math.trunc = function (v) (v = +v, (v - v % 1) || (!isFinite(v) || v === 0 ? v : v < 0 ? -0 : 0));

Math.toRadians = function (degrees) degrees * 0.01745329252;

Math.toDegrees = function (radians) radians * 57.29577951308;

Math.sign = function (num) num ? num < 0 ? -1 : 1 : 0;

Object.values = function (obj) Object.keys(obj).map(function (key) obj[key]);

/*----------------*/
/* Importing core */
/*----------------*/

function importPackage(/*package, ...*/) Core.importedPackages.pushArray(getArguments(arguments));

function importFromScript(scriptInfo, propertyName) {
    if (scriptInfo instanceof Script) return this[propertyName] = Core.scriptEngineField.get(scriptInfo).get(propertyName);
    for each (var script in scriptManager.scripts) if (script.scriptName == scriptInfo) return this[propertyName] = Core.scriptEngineField.get(script).get(propertyName);
}

function importProperties(scriptInfo) {
    if (scriptInfo instanceof Script) return Core.importedScripts.push(Core.scriptEngineField.get(scriptInfo));
    for each (var script in scriptManager.scripts) if (script.scriptName == scriptInfo) return Core.importedScripts.push(Core.scriptEngineField.get(script));
}

__noSuchProperty__ = function (name) {
    if (name.endsWith("Module")) {
        var module = LiquidBounce.moduleManager.getModule(name.slice(0, -6));
        if (module) return this[name] = module;
    }

    for each (var engine in Core.importedScripts) {
        try {
            var property = engine.get(name);
            return this[name] = property;
        } catch (e) {}
    }

    for each (var package in Core.importedPackages) {
        try {
            var type = Java.type(package + "." + name);
            return this[name] = type;
        } catch (e) {}
    }

    throw new ReferenceError(name + " is not defined");
}

/*----------------*/
/* Java importing */
/*----------------*/

Core.importedPackages = [
    "net.minecraft.block", "net.minecraft.block.material", "net.minecraft.block.properties", "net.minecraft.block.state",
    "net.minecraft.client.gui", "net.minecraft.client.gui.inventory",
    "net.minecraft.client.renderer", "net.minecraft.client.renderer.block.model",
    "net.minecraft.entity", "net.minecraft.entity.boss", "net.minecraft.entity.effect", "net.minecraft.entity.item", "net.minecraft.entity.monster", "net.minecraft.entity.passive", "net.minecraft.entity.player", "net.minecraft.entity.projectile",
    "net.minecraft.init",
    "net.minecraft.item",
    "net.minecraft.network", "net.minecraft.network.handshake.client", "net.minecraft.network.login.client", "net.minecraft.network.login.server", "net.minecraft.network.play.client", "net.minecraft.network.play.client.C03PacketPlayer", "net.minecraft.network.play.server", "net.minecraft.network.status.client", "net.minecraft.network.status.server",
    "net.minecraft.util",
    "net.minusmc.minusbounce.utils", "net.minusmc.minusbounce.utils.block", "net.minusmc.minusbounce.utils.extensions", "net.minusmc.minusbounce.utils.item", "net.minusmc.minusbounce.utils.login", "net.minusmc.minusbounce.utils.misc", "net.minusmc.minusbounce.utils.render", "net.minusmc.minusbounce.utils.render.shader", "net.minusmc.minusbounce.utils.render.shader.shaders", "net.minusmc.minusbounce.utils.timer",
    "net.minusmc.minusbounce.value",
    "net.minusmc.minusbounce.event"
];

Core.importedScripts = [];

//Used variables
URL = java.net.URL;
File = java.io.File;
List = java.util.List;
Class = java.lang.Class;
Timer = java.util.Timer;
Thread = java.lang.Thread;
System = java.lang.System;
Field = java.lang.reflect.Field;
ArrayList = java.util.ArrayList;
Keyboard = org.lwjgl.input.Keyboard;
Modifier = java.lang.reflect.Modifier;
JOptionPane = javax.swing.JOptionPane;
Desktop = java.awt.Desktop.getDesktop();
LinkedHashMap = java.util.LinkedHashMap;
FileUtils = org.apache.commons.io.FileUtils;
HoverEvent = Java.type("net.minecraft.event.HoverEvent");
Script = Java.type("net.minusmc.scriptsplugin.Script");
Enchantment = Java.type("net.minecraft.enchantment.Enchantment");
LiquidBounce = Java.type("net.minusmc.minusbounce.MinusBounce");
FileManager = Java.type("net.minusmc.minusbounce.file.FileManager");
Module = Java.type("net.minusmc.minusbounce.features.module.Module");
Command = Java.type("net.minusmc.minusbounce.features.command.Command");
Remapper = Java.type("net.minusmc.scriptsplugin.remapper.Remapper");
StyleMode = Java.type("net.minusmc.minusbounce.ui.client.clickgui.styles.StyleMode")
ScriptModule = Java.type("net.minusmc.scriptsplugin.api.ScriptModule");
ValuesConfig = Java.type("net.minusmc.minusbounce.file.configs.ValuesConfig");
ModuleCategory = Java.type("net.minusmc.minusbounce.features.module.ModuleCategory");
PositionedSoundRecord = Java.type("net.minecraft.client.audio.PositionedSoundRecord");

Core.defaultAnnotation = getMethod(LiquidBounce.moduleManager, "onKey").getAnnotation(EventTarget.class);
Core.outboundPacketsQueueField = getField(NetworkManager, "field_150745_j");
Core.flushOutboundQueueMethod = getMethod(NetworkManager, "func_150733_h");
Core.dispatchPacketMethod = getMethod(NetworkManager, "func_150732_b");
Core.registeredCommandsField = getField(Script, "registeredCommands");
Core.readWriteLockField = getField(NetworkManager, "field_181680_j");
Core.registeredModulesField = getField(Script, "registeredModules");
Core.remapperMethods = getField(Remapper, "methods").get(Remapper);
Core.remapperFields = getField(Remapper, "fields").get(Remapper);
Core.eventManager = new Reflector(LiquidBounce.eventManager);
Core.callEventMethod = getMethod(ScriptModule, "callEvent");
Core.scriptEngineField = getField(Script, "scriptEngine");
Core.categories = new EditableEnum(ModuleCategory);
Core.scriptReflector = new Reflector(script);
Core.artificialEvents = {
    onBlockBB: BlockBBEvent.class,
    onClickWindow: ClickWindowEvent.class,
    onEntityMovement: EntityMovementEvent.class,
    onPushOut: PushOutEvent.class,
    onRenderEntity: RenderEntityEvent.class,
    onScreen: ScreenEvent.class,
    onText: TextEvent.class,
    onTick: TickEvent.class
};

/*-------------*/
/* Event hooks */
/*-------------*/

Core.hookClickGui = function () {
    LiquidBounce.moduleManager.getModule(ClickGUI.class).getStyle().class.newInstance()
    LiquidBounce.fileManager.loadConfig(LiquidBounce.fileManager.clickGuiConfig);
    if (mc.currentScreen instanceof StyleMode) ClickGUIModule.onEnable();
    callEvent("clickGuiLoaded");
};

Core.hookFileManager = function () {
    Core.ignoreValueChange = false;
    LiquidBounce.fileManager = new (Java.extend(FileManager))() {
        saveConfig: function (config) {
            if (config instanceof ValuesConfig) {
                if (Core.ignoreValueChange) Core.ignoreValueChange = false;
                else callEvent("valueChanged");
            }
            Java.super(LiquidBounce.fileManager).saveConfig(config);
        }
    }
}

Core.hookReloader = function () {
    var ReloadCommand = Java.type("net.minusmc.minusbounce.features.command.commands.ReloadCommand"),
        ModuleCommand = Java.type("net.minusmc.minusbounce.features.module.ModuleCommand"),
        Fonts = Java.type("net.minusmc.minusbounce.ui.font.Fonts"),
        FileConfigClass = Class.forName("net.minusmc.minusbounce.file.FileConfig");
    for each (var command in LiquidBounce.commandManager.commands.clone()) {
        if (command instanceof ReloadCommand) {
            LiquidBounce.commandManager.commands.remove(command);

            return Core.registerCommand({
                name: "Reloader",
                aliases: ["reload", "r"],
                author: "CzechHek",
                version: "4.5",
                handler: function (type) {
                    clearChat();
                    var startMs = System.currentTimeMillis();
                    switch (type.toLowerCase()) {
                        case "scripts":
                            LiquidBounce.INSTANCE.setStarting(true);

                            for each (var script in scriptManager.scripts) {
                                var registeredModules = Core.registeredModulesField.get(script);
                                for each (var module in registeredModules) module.state && module.onDisable();

                                script.onDisable();
                            }
                            scriptManager.unloadScripts();

                            for each (var command in LiquidBounce.commandManager.commands.clone())
                                command instanceof ModuleCommand && command.getModule() instanceof ScriptModule && LiquidBounce.commandManager.unregisterCommand(command);

                            for each (var file in scriptManager.scriptsFolder.listFiles()) {
                                if (file.getName().endsWith(".js")) {
                                    try {
                                        var newScript = new Script(file);
                                        newScript.initScript();
                                    } catch (e) {
                                        print("§4▏ §c§lFailed§c to reload script „§4" + file.getName().slice(0, -3) + "§c“§4!");
                                        print(e);
                                        continue
                                    }
                                    scriptManager.scripts.add(newScript);
                                }
                            }
                            scriptManager.enableScripts();

                            LiquidBounce.fileManager.loadConfigs(LiquidBounce.fileManager.modulesConfig, LiquidBounce.fileManager.valuesConfig);
                            LiquidBounce.INSTANCE.setStarting(false);

                            if (scriptManager.scripts.length) {
                                var component = new ChatComponentText("§2▏ §a§lReloaded§a scripts in §9" + (System.currentTimeMillis() - startMs) + "ms§2! §8(§7§l" + scriptManager.scripts.length + "§8) ");
                                component.getChatStyle().setChatHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, new ChatComponentText("§a§l" + Java.from(scriptManager.scripts).map(function (script) script.scriptName).join("§2,§a§l "))));

                                mc.thePlayer.addChatMessage(component);
                            }
                            break
                        case "fonts":
                            Fonts.loadFonts();

                            var fonts = Java.from(Fonts.getFonts()),
                                component = new ChatComponentText("§2▏ §a§lReloaded§a all fonts in §9" + (System.currentTimeMillis() - startMs) + "ms§2! §8(§7§l" + fonts.length + "§8)");
                            component.getChatStyle().setChatHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, new ChatComponentText("§a§l" + fonts.map(function (font, i) i ? font.getDefaultFont().getFont().getName() : "Minecraft").join("§2,§a§l "))));

                            mc.thePlayer.addChatMessage(component);
                            break
                        case "configs":
                            LiquidBounce.fileManager.loadAllConfigs();

                            var configs = Java.from(LiquidBounce.fileManager.class.superclass.getDeclaredFields()).filter(function (field) field.getType() == FileConfigClass),
                                component = new ChatComponentText("§2▏ §a§lReloaded§a all configs in §9" + (System.currentTimeMillis() - startMs) + "ms§2! §8(§7§l" + configs.length + "§8)");
                            component.getChatStyle().setChatHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, new ChatComponentText("§a§l" + configs.map(function (config) {
                                var name = config.getName();
                                return name[0].toUpperCase() + name.slice(1, -6);
                            }).join("§2,§a§l "))));

                            mc.thePlayer.addChatMessage(component);
                            break
                        default:
                            var script = Java.from(scriptManager.scripts).find(function (script) script.scriptName.equalsIgnoreCase(type)),
                                importing;
                            if (!script) {
                                script = Java.from(scriptManager.scriptsFolder.listFiles()).find(function (file) file.getName().endsWith(".js") && file.getName().slice(0, -3).equalsIgnoreCase(type));

                                if (!script) return print("§4▏ §cScript „§4" + type + "§c“ §lnot found§4!");
                                importing = true;
                            }

                            LiquidBounce.INSTANCE.setStarting(true);

                            if (!importing) {
                                script.onDisable();
                                scriptManager.scripts.remove(script);

                                var registeredModules = Core.registeredModulesField.get(script);
                                if (registeredModules.length) {
                                    for each (var module in registeredModules) module.state && module.onDisable();

                                    for each (var command in LiquidBounce.commandManager.commands.clone()) {
                                        if (!(command instanceof ModuleCommand)) continue
                                        for each (var module in registeredModules) {
                                            if (command.getModule() == module) {
                                                LiquidBounce.commandManager.unregisterCommand(command);
                                                registeredModules.remove(module);
                                                break
                                            }
                                        }
                                    }
                                }
                            }

                            try {
                                var newScript = new Script(importing ? script : script.scriptFile);
                                newScript.initScript();
                            } catch (e) {
                                print("§4▏ §c§lFailed§c to reload script „§4" + type + "§c“§4!");
                                print(e);
                                LiquidBounce.INSTANCE.setStarting(false);
                                return
                            }

                            scriptManager.scripts.add(newScript);
                            newScript.onEnable();

                            LiquidBounce.fileManager.loadConfigs(LiquidBounce.fileManager.modulesConfig, LiquidBounce.fileManager.valuesConfig);
                            LiquidBounce.INSTANCE.setStarting(false);

                            print("§2▏ §a§l" + (importing ? "L" : "Rel") + "oaded §ascript „§2" + newScript.scriptName + "§a“ in §9" + (System.currentTimeMillis() - startMs) + "ms§2!");
                    }
                },
                onTabComplete: function (args) {
                    if (args.length > 1) return

                    var scripts = Java.from(scriptManager.scripts),
                        options = scripts.map(function (script) script.scriptName);

                    for each (var file in scriptManager.scriptsFolder.listFiles())
                        file.getName().endsWith(".js") && !scripts.some(function (script) script.scriptFile.getName() === file.getName()) && options.push(file.getName().slice(0, -3));

                    options.push("ClickGUI", "fonts", "scripts", "configs");
                    return options.filter(function (name) name.startsWithIgnoreCase(args[0]));
                }
            }, true);
        }
    }
}

/*-------------------*/
/* Module management */
/*-------------------*/

script.on("load", function () {
    module = toArray(module || {}); command = toArray(command || {});

    if (!Core.API_V2) {
        script.scriptName = (script.scriptName === "Legacy Script" ? scriptName || module[0].name || command[0].name || (command[0].aliases && command[0].aliases[0]) || script.scriptFile.getName().slice(0, -3) : script.scriptName).toString();
        script.scriptAuthors = script.scriptAuthors[0] === "Please Update Script" ? toArray((scriptAuthor || module[0].author || command[0].author || "Author").toString()) : script.scriptAuthors;
        script.scriptVersion = (script.scriptVersion === "1.0.0" ? scriptVersion || module[0].version || command[0].version || "1.0.0" : script.scriptVersion).toString() + " §7[§4CoreLib API§7]";
    }

    if (Core.shouldReload) {
        var newScript = new Script(script.scriptFile);
        newScript.initScript();
        scriptManager.scripts.add(newScript);

        if (script.scriptVersion != newScript.scriptVersion) {
            var coreObj = importFromScript(newScript, "Core");
            if (coreObj.onScriptUpdate) coreObj.onScriptUpdate(script.scriptVersion, newScript.scriptVersion);
            //Calls Core.onScriptUpdate(oldVersion, newVersion) in the script that got updated.
        }

        script.on("enable", function () timeout(1000, function () scriptManager.scripts.remove(script))); //Prevents ConcurrentModificationException because you cannot alter ArrayList when for looping through it.
        return
    }

    [module, command].forEach(function (c, i) c.forEach(function (v) Core[["registerModule", "registerCommand"][i]](v)));

    script.on("enable", function () {
        for each (var c in [module, command]) for each (var v in c) v.onLoad && v.onLoad();

        Core.onLoad && Core.onLoad();
    });

    script.on("disable", function () {
        for each (var c in [module, command]) for each (var v in c) v.onUnload && v.onUnload();

        //Unregistering artificial event hooks
        for each (var entry in Core.hookedEvents.entrySet()) {
            var key = entry.getKey(), targets = entry.getValue();
            for each (var target in targets) Core.eventManager.registry[key].remove(target);
        }

        if (Core.log.eventHooks == script.scriptName) {
            Core.log = JSON.parse(FileUtils.readFileToString(Core.logFile));
            delete Core.log.eventHooks;
            FileUtils.writeStringToFile(Core.logFile, JSON.stringify(Core.log));
        }

        Core.onUnload && Core.onUnload();
    });
});